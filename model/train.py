"""
train.py
--------
Fine-tunes HeightUNet on GAMUS (or the synthetic smoke-test set).

Usage:
    python train.py --data-root /path/to/gamus --epochs 30 --batch-size 16
    python train.py --smoke-test              # quick sanity run, no real data needed
"""

import argparse
import time
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from dataset import GAMUSDataset, make_synthetic_dataset
from unet import HeightUNet


def huber_loss(pred, target, delta=1.0):
    return torch.nn.functional.huber_loss(pred, target, delta=delta)


def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train] device = {device}")

    if args.smoke_test:
        train_ds = make_synthetic_dataset(n=32, size=64)
        val_ds = make_synthetic_dataset(n=8, size=64)
    else:
        train_ds = GAMUSDataset(args.data_root, image_size=args.image_size, augment=True)
        # simple 90/10 split by index; swap for GAMUS's official split if you
        # download the split lists too
        n_val = max(1, int(0.1 * len(train_ds)))
        val_ds = torch.utils.data.Subset(train_ds, range(n_val))
        train_ds = torch.utils.data.Subset(train_ds, range(n_val, len(train_ds)))

    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True, num_workers=args.workers)
    val_loader = DataLoader(val_ds, batch_size=args.batch_size, shuffle=False, num_workers=args.workers)

    use_pretrained = (not args.smoke_test) and (not args.no_pretrained)
    model = HeightUNet(pretrained=use_pretrained).to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_val = float("inf")
    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    for epoch in range(args.epochs):
        model.train()
        t0 = time.time()
        running_loss = 0.0
        for images, depths in train_loader:
            images, depths = images.to(device), depths.to(device)
            optimizer.zero_grad()
            preds = model(images)
            loss = huber_loss(preds, depths)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * images.size(0)
        train_loss = running_loss / len(train_loader.dataset)

        model.eval()
        val_loss, val_rmse = 0.0, 0.0
        with torch.no_grad():
            for images, depths in val_loader:
                images, depths = images.to(device), depths.to(device)
                preds = model(images)
                val_loss += huber_loss(preds, depths).item() * images.size(0)
                val_rmse += torch.sqrt(torch.mean((preds - depths) ** 2)).item() * images.size(0)
        val_loss /= len(val_loader.dataset)
        val_rmse /= len(val_loader.dataset)

        scheduler.step()
        dt = time.time() - t0
        print(f"epoch {epoch+1:03d}/{args.epochs} | train {train_loss:.4f} | val {val_loss:.4f} | val RMSE {val_rmse:.3f} | {dt:.1f}s")

        if val_loss < best_val:
            best_val = val_loss
            torch.save(model.state_dict(), ckpt_dir / "best.pt")

    torch.save(model.state_dict(), ckpt_dir / "last.pt")
    print(f"[train] done. best val loss = {best_val:.4f}. checkpoints in {ckpt_dir}/")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--data-root", type=str, default=None, help="Path to downloaded GAMUS root")
    parser.add_argument("--image-size", type=int, default=256)
    parser.add_argument("--batch-size", type=int, default=16)
    parser.add_argument("--epochs", type=int, default=30)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--workers", type=int, default=2)
    parser.add_argument("--checkpoint-dir", type=str, default="checkpoints")
    parser.add_argument("--smoke-test", action="store_true", help="Run on tiny synthetic data to verify the pipeline works end to end")
    parser.add_argument("--no-pretrained", action="store_true", help="Skip downloading ImageNet-pretrained ResNet34 weights (use this if you have no internet access or the download is blocked; real training runs should leave this off)")
    args = parser.parse_args()

    if not args.smoke_test and not args.data_root:
        parser.error("--data-root is required unless --smoke-test is set")

    train(args)
