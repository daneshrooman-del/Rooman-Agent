"""Talking-head output: turn the agent's speech audio into a lip-synced video track."""

from trackb.avatar.output import AvatarAVOutput
from trackb.avatar.placeholder import AmplitudeFaceRenderer
from trackb.avatar.renderer import FaceRenderer, Frame

__all__ = ["AmplitudeFaceRenderer", "AvatarAVOutput", "FaceRenderer", "Frame"]
