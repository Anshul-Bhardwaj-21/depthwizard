"""
train.py
--------
Trains HeightUNet on paired RGB + nDSM tiles.

Quick start
-----------
# 1. Prepare training data (choose ONE option):

    ## Option A — Synthetic data, NO internet needed (recommended for first run)
    python data/prepare_data.py                    # generates 200 procedural tiles

    ## Option B — More synthetic tiles
    python data/prepare_data.py --n-tiles 500

    ## Option C — Real GAMUS from HuggingFace (chunked/resumable download)
    python data/prepare_data.py --mode hf-cli      # falls back to synthetic if it fails

    ## Option D — You already have data in a folder
    python data/prepare_data.py --mode manual --root ./my_data

# 2. Smoke test (no data needed, verifies pipeline works — run this first!)
    python train.py --smoke-test

# 3. Real training on prepared data
    python train.py --data-root data/ --epochs 30 --batch-size 8

# 4. One-click script (Windows) — prepares data + trains in sequence
    .\\..\\run_training.ps1

GPU tip: training is ~10x faster on CUDA — any NVIDIA GTX 1060+ works.
"""

import argparse
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader, random_split

from dataset import GAMUSDataset, make_synthetic_dataset
from unet import HeightUNet


# ── Loss functions ────────────────────────────────────────────────────────────

def huber_loss(pred: torch.Tensor, target: torch.Tensor, delta: float = 1.0) -> torch.Tensor:
    """Huber (smooth L1) loss — robust to outlier heights at tile edges."""
    return nn.functional.huber_loss(pred, target, delta=delta)


def rmse(pred: torch.Tensor, target: torch.Tensor) -> float:
    """Root Mean Square Error in metres."""
    return float(torch.sqrt(torch.mean((pred - target) ** 2)).item())


def mae(pred: torch.Tensor, target: torch.Tensor) -> float:
    """Mean Absolute Error in metres."""
    return float(torch.mean(torch.abs(pred - target)).item())


# ── Training loop ─────────────────────────────────────────────────────────────

def train(args):
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"[train] device       = {device}")
    print(f"[train] image size   = {args.image_size}×{args.image_size}")
    print(f"[train] batch size   = {args.batch_size}")
    print(f"[train] epochs       = {args.epochs}")
    print(f"[train] lr           = {args.lr}")

    # ── Dataset ────────────────────────────────────────────────────────────
    if args.smoke_test:
        print("[train] ★ SMOKE TEST — using tiny synthetic dataset")
        full_ds  = make_synthetic_dataset(n=64, size=64)
        n_val    = 8
        n_train  = 56
        train_ds, val_ds = random_split(full_ds, [n_train, n_val],
                                         generator=torch.Generator().manual_seed(42))
    else:
        print(f"[train] loading GAMUS from: {args.data_root}")
        full_ds = GAMUSDataset(args.data_root, image_size=args.image_size, augment=False)

        # 90 / 10 train / val split (deterministic)
        n_val   = max(1, int(len(full_ds) * 0.10))
        n_train = len(full_ds) - n_val
        train_ds, val_ds = random_split(
            full_ds, [n_train, n_val],
            generator=torch.Generator().manual_seed(42)
        )
        # Enable augmentation only on the training subset
        train_ds.dataset.augment = True

    print(f"[train] train tiles  = {len(train_ds)}")
    print(f"[train] val tiles    = {len(val_ds)}")

    nw = min(args.workers, 4)
    train_loader = DataLoader(train_ds, batch_size=args.batch_size, shuffle=True,
                              num_workers=nw, pin_memory=(device.type == "cuda"))
    val_loader   = DataLoader(val_ds,   batch_size=args.batch_size, shuffle=False,
                              num_workers=nw, pin_memory=(device.type == "cuda"))

    # ── Model ──────────────────────────────────────────────────────────────
    use_pretrained = (not args.smoke_test) and (not args.no_pretrained)
    model = HeightUNet(pretrained=use_pretrained).to(device)

    total_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"[train] model params = {total_params/1e6:.1f} M")

    # ── Optimizer & Scheduler ─────────────────────────────────────────────
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=1e-4)
    # Cosine annealing: lr drops smoothly from args.lr → 0 over all epochs
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs, eta_min=1e-6)

    # ── Checkpoint dir ────────────────────────────────────────────────────
    ckpt_dir = Path(args.checkpoint_dir)
    ckpt_dir.mkdir(parents=True, exist_ok=True)

    best_val_rmse = float("inf")
    history = []

    print("\n" + "─" * 72)
    print(f"{'Epoch':>6}  {'TrainLoss':>10}  {'ValLoss':>10}  {'ValRMSE':>10}  {'ValMAE':>8}  {'LR':>9}  {'Time':>6}")
    print("─" * 72)

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()

        # ── Train ──────────────────────────────────────────────────────
        model.train()
        running_loss = 0.0
        for images, depths in train_loader:
            images, depths = images.to(device), depths.to(device)
            optimizer.zero_grad()
            preds = model(images)
            loss  = huber_loss(preds, depths)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), max_norm=2.0)
            optimizer.step()
            running_loss += loss.item() * images.size(0)
        train_loss = running_loss / len(train_loader.dataset)

        # ── Validate ───────────────────────────────────────────────────
        model.eval()
        val_loss  = 0.0
        val_rmse_acc = 0.0
        val_mae_acc  = 0.0
        with torch.no_grad():
            for images, depths in val_loader:
                images, depths = images.to(device, non_blocking=True), depths.to(device, non_blocking=True)
                preds = model(images)
                val_loss     += huber_loss(preds, depths).item() * images.size(0)
                val_rmse_acc += rmse(preds, depths) * images.size(0)
                val_mae_acc  += mae(preds, depths)  * images.size(0)
        val_loss      /= len(val_loader.dataset)
        val_rmse_val   = val_rmse_acc / len(val_loader.dataset)
        val_mae_val    = val_mae_acc  / len(val_loader.dataset)

        scheduler.step()
        current_lr = scheduler.get_last_lr()[0]
        elapsed    = time.time() - t0

        # ── Log ─────────────────────────────────────────────────────────
        marker = " ← best" if val_rmse_val < best_val_rmse else ""
        print(f"{epoch:>6}  {train_loss:>10.4f}  {val_loss:>10.4f}  {val_rmse_val:>8.3f}m  {val_mae_val:>6.3f}m  {current_lr:>9.2e}  {elapsed:>5.1f}s{marker}")
        history.append(dict(epoch=epoch, train_loss=train_loss,
                            val_loss=val_loss, val_rmse=val_rmse_val, val_mae=val_mae_val))

        # ── Save checkpoint if best ──────────────────────────────────────
        if val_rmse_val < best_val_rmse:
            best_val_rmse = val_rmse_val
            torch.save(model.state_dict(), ckpt_dir / "best.pt")

        # ── Periodic checkpoint every 10 epochs ─────────────────────────
        if epoch % 10 == 0:
            torch.save(model.state_dict(), ckpt_dir / f"epoch_{epoch:03d}.pt")

    torch.save(model.state_dict(), ckpt_dir / "last.pt")

    # ── Summary ─────────────────────────────────────────────────────────
    print("─" * 72)
    print(f"[train] ✓ Done — best val RMSE = {best_val_rmse:.3f} m")
    print(f"[train]   best.pt → {(ckpt_dir / 'best.pt').resolve()}")
    print(f"[train]   last.pt → {(ckpt_dir / 'last.pt').resolve()}")

    # Save training history CSV
    try:
        import csv
        csv_path = ckpt_dir / "history.csv"
        with open(csv_path, "w", newline="") as f:
            w = csv.DictWriter(f, fieldnames=history[0].keys())
            w.writeheader(); w.writerows(history)
        print(f"[train]   history  → {csv_path.resolve()}")
    except Exception:
        pass


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train HeightUNet on GAMUS RGB→nDSM",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    parser.add_argument("--data-root",       type=str,   default=None,
                        help="Path to GAMUS root (must contain images/ and depth/)")
    parser.add_argument("--image-size",      type=int,   default=256,
                        help="Resize tiles to N×N before feeding to model")
    parser.add_argument("--batch-size",      type=int,   default=8,
                        help="Training batch size (reduce if OOM)")
    parser.add_argument("--epochs",          type=int,   default=30)
    parser.add_argument("--lr",              type=float, default=3e-4,
                        help="Initial learning rate (CosineAnnealing schedule)")
    parser.add_argument("--workers",         type=int,   default=2,
                        help="DataLoader worker processes")
    parser.add_argument("--checkpoint-dir",  type=str,   default="checkpoints",
                        help="Directory for best.pt / last.pt / epoch_NNN.pt")
    parser.add_argument("--smoke-test",      action="store_true",
                        help="Quick sanity run on synthetic data — no GAMUS download needed")
    parser.add_argument("--no-pretrained",   action="store_true",
                        help="Skip downloading ImageNet weights (use offline)")

    args = parser.parse_args()

    if not args.smoke_test and not args.data_root:
        parser.error(
            "--data-root is required unless --smoke-test is set.\n"
            "Download GAMUS first:\n"
            "  pip install datasets huggingface_hub\n"
            "  python data/download_gamus.py --split validation --out data/"
        )

    train(args)
