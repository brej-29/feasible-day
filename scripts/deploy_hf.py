"""Publish dist/ to a free static Hugging Face Space.

    npm run build
    uvx --from huggingface_hub python scripts/deploy_hf.py BrejBala/feasible-day

Needs a token with write access: `hf auth login`, or HF_TOKEN in the environment (a repository secret in CI).
"""
import pathlib
import sys

from huggingface_hub import HfApi

repo_id = sys.argv[1]
dist = pathlib.Path("dist")
if not (dist / "index.html").exists():
    sys.exit("dist/index.html missing: run `npm run build` first")

card = """---
title: Feasible Day
emoji: 🧭
colorFrom: yellow
colorTo: gray
sdk: static
pinned: false
short_description: Walking day plans checked against opening hours
---
"""
(dist / "README.md").write_text(card, encoding="utf-8")

api = HfApi()
api.create_repo(repo_id=repo_id, repo_type="space", space_sdk="static", exist_ok=True)
api.upload_folder(folder_path=str(dist), repo_id=repo_id, repo_type="space", commit_message="Deploy build")
print(f"https://huggingface.co/spaces/{repo_id}")
