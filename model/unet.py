"""
unet.py
-------
U-Net-style encoder-decoder for monocular height (nDSM) regression, using a
pretrained ResNet34 as the encoder. This is deliberately NOT a from-scratch
transformer/diffusion model: published benchmarks on this exact task (GAMUS /
GBH) show a plain pretrained-encoder U-Net lands within a small margin of much
heavier architectures, so this is the better time/accuracy trade-off for a
hackathon timeline. Swap in a fancier decoder later only if this baseline is
clearly the bottleneck.
"""

import torch
import torch.nn as nn
import torchvision.models as tv_models


class ConvBlock(nn.Module):
    def __init__(self, in_ch, out_ch):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
            nn.Conv2d(out_ch, out_ch, 3, padding=1, bias=False),
            nn.BatchNorm2d(out_ch),
            nn.ReLU(inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class UpBlock(nn.Module):
    def __init__(self, in_ch, skip_ch, out_ch):
        super().__init__()
        self.up = nn.ConvTranspose2d(in_ch, out_ch, kernel_size=2, stride=2)
        self.conv = ConvBlock(out_ch + skip_ch, out_ch)

    def forward(self, x, skip):
        x = self.up(x)
        if x.shape[-2:] != skip.shape[-2:]:
            x = nn.functional.interpolate(x, size=skip.shape[-2:], mode="bilinear", align_corners=False)
        x = torch.cat([x, skip], dim=1)
        return self.conv(x)


class HeightUNet(nn.Module):
    """
    ResNet34 encoder (ImageNet-pretrained) + U-Net decoder.
    Input:  Bx3xHxW RGB in [0, 1]
    Output: Bx1xHxW predicted *relative* height (unitless until calibrated)
    """

    def __init__(self, pretrained: bool = True, out_activation: str = "softplus"):
        super().__init__()
        weights = tv_models.ResNet34_Weights.IMAGENET1K_V1 if pretrained else None
        resnet = tv_models.resnet34(weights=weights)

        self.stem = nn.Sequential(resnet.conv1, resnet.bn1, resnet.relu)  # /2,  64ch
        self.pool = resnet.maxpool
        self.enc1 = resnet.layer1  # /4,  64ch
        self.enc2 = resnet.layer2  # /8,  128ch
        self.enc3 = resnet.layer3  # /16, 256ch
        self.enc4 = resnet.layer4  # /32, 512ch

        self.up4 = UpBlock(512, 256, 256)
        self.up3 = UpBlock(256, 128, 128)
        self.up2 = UpBlock(128, 64, 64)
        self.up1 = UpBlock(64, 64, 64)

        self.final_up = nn.ConvTranspose2d(64, 32, kernel_size=2, stride=2)
        self.head = nn.Conv2d(32, 1, kernel_size=1)

        self.out_activation = out_activation

    def forward(self, x):
        s0 = self.stem(x)          # /2
        p0 = self.pool(s0)         # /4
        e1 = self.enc1(p0)         # /4
        e2 = self.enc2(e1)         # /8
        e3 = self.enc3(e2)         # /16
        e4 = self.enc4(e3)         # /32

        d4 = self.up4(e4, e3)
        d3 = self.up3(d4, e2)
        d2 = self.up2(d3, e1)
        d1 = self.up1(d2, s0)

        out = self.final_up(d1)
        out = nn.functional.interpolate(out, size=x.shape[-2:], mode="bilinear", align_corners=False)
        out = self.head(out)

        if self.out_activation == "softplus":
            out = nn.functional.softplus(out)  # keeps predicted height >= 0
        return out


if __name__ == "__main__":
    # quick shape sanity check
    model = HeightUNet(pretrained=False)
    dummy = torch.rand(2, 3, 256, 256)
    with torch.no_grad():
        out = model(dummy)
    assert out.shape == (2, 1, 256, 256), out.shape
    print("HeightUNet forward pass OK, output shape:", tuple(out.shape))
