"""SadTalker worker — runs inside .venvs/sadtalker with cwd = third_party/SadTalker.

ops:
  prepare  {image, out_dir, size, preprocess, ref_video?}
           -> 3DMM-fit the twin's reference image once (the expensive, reusable part)
              and, optionally, extract the person's own head-motion coefficients
              from a clip of their reference video.
  render   {prep_dir, audio, out, size, preprocess, still, enhancer?, pose_style,
            use_ref_pose, expression_scale}
           -> audio-driven talking video of the prepared twin.
"""
import json
import os
import pickle
import shutil
import sys
import traceback


def _paths(size, preprocess):
    from src.utils.init_path import init_path

    return init_path("./checkpoints", os.path.join(os.getcwd(), "src/config"), size, False, preprocess)


def _device():
    import torch

    return "cuda" if torch.cuda.is_available() else "cpu"


def prepare(req):
    from src.utils.preprocess import CropAndExtract

    out_dir = req["out_dir"]
    os.makedirs(out_dir, exist_ok=True)
    extractor = CropAndExtract(_paths(req["size"], req["preprocess"]), _device())
    coeff, crop_pic, crop_info = extractor.generate(req["image"], out_dir, req["preprocess"], source_image_flag=True, pic_size=req["size"])
    if coeff is None:
        return {"error": "SadTalker could not fit a 3D face to the reference frame."}
    with open(os.path.join(out_dir, "crop_info.pkl"), "wb") as f:
        pickle.dump(crop_info, f)
    ref_coeff = None
    if req.get("ref_video"):
        ref_dir = os.path.join(out_dir, "ref_motion")
        os.makedirs(ref_dir, exist_ok=True)
        ref_coeff, _, _ = extractor.generate(req["ref_video"], ref_dir, req["preprocess"], source_image_flag=False)
    return {"first_coeff": coeff, "crop_pic": crop_pic, "ref_coeff": ref_coeff}


def render(req):
    from src.facerender.animate import AnimateFromCoeff
    from src.generate_batch import get_data
    from src.generate_facerender_batch import get_facerender_data
    from src.test_audio2coeff import Audio2Coeff

    device = _device()
    paths = _paths(req["size"], req["preprocess"])
    prep = req["prep"]
    with open(os.path.join(req["prep_dir"], "crop_info.pkl"), "rb") as f:
        crop_info = pickle.load(f)

    work = req["work_dir"]
    os.makedirs(work, exist_ok=True)
    ref_coeff = prep.get("ref_coeff") if req.get("use_ref_pose") else None

    batch = get_data(prep["first_coeff"], req["audio"], device, ref_eyeblink_coeff_path=prep.get("ref_coeff"), still=req["still"])
    coeff_path = Audio2Coeff(paths, device).generate(batch, work, req.get("pose_style", 0), ref_coeff)
    data = get_facerender_data(
        coeff_path, prep["crop_pic"], prep["first_coeff"], req["audio"], req.get("batch_size", 2),
        None, None, None, expression_scale=req.get("expression_scale", 1.0), still_mode=req["still"],
        preprocess=req["preprocess"], size=req["size"],
    )
    result = AnimateFromCoeff(paths, device).generate(
        data, work, req["image"], crop_info, enhancer=req.get("enhancer"), background_enhancer=None,
        preprocess=req["preprocess"], img_size=req["size"],
    )
    shutil.move(result, req["out"])
    return {"video": req["out"], "device": device}


def main():
    req = json.loads(sys.stdin.read())
    sys.path.insert(0, os.getcwd())
    try:
        out = {"prepare": prepare, "render": render}[req["op"]](req)
    except Exception as e:  # report cleanly to the orchestrator
        traceback.print_exc()
        out = {"error": f"{type(e).__name__}: {e}"}
    print("RESULT " + json.dumps(out), flush=True)


if __name__ == "__main__":
    main()
