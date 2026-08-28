from fastapi import APIRouter
from pydantic import BaseModel

from ..tools import files

router = APIRouter(prefix="/api/workspace")


@router.get("/files")
async def list_files(path: str = "."):
    try:
        listing = await files.list_files(path)
        return {"ok": True, **listing}
    except (FileNotFoundError, ValueError) as exc:
        return {"ok": False, "error": str(exc)}


@router.get("/file")
async def read_file(path: str):
    try:
        return {"ok": True, **(await files.read_file(path))}
    except (FileNotFoundError, ValueError, PermissionError, OSError) as exc:
        return {"ok": False, "error": str(exc)}


class WriteRequest(BaseModel):
    path: str
    content: str


@router.post("/file")
async def write_file(req: WriteRequest):
    try:
        result = await files.write_file(req.path, req.content)
        return {"ok": True, **result}
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}
    except OSError as exc:
        return {"ok": False, "error": f"写入失败: {exc}"}


class DeleteRequest(BaseModel):
    path: str


@router.post("/file/delete")
async def remove_file(req: DeleteRequest):
    try:
        result = await files.delete_file(req.path)
        return {"ok": True, **result}
    except (FileNotFoundError, ValueError) as exc:
        return {"ok": False, "error": str(exc)}
    except OSError as exc:
        return {"ok": False, "error": f"删除失败: {exc}"}


class SearchRequest(BaseModel):
    keyword: str
    subdir: str = "."


@router.post("/search")
async def search_files(req: SearchRequest):
    try:
        hits = await files.search_files(req.keyword, req.subdir)
        return {"ok": True, "hits": hits}
    except (FileNotFoundError, ValueError) as exc:
        return {"ok": False, "error": str(exc), "hits": []}


class ModeRequest(BaseModel):
    mode: str


@router.get("/mode")
async def get_mode():
    return {"mode": files.get_access_mode(), "sandbox_root": str(files.WORKSPACE)}


@router.get("/drives")
async def get_drives():
    return {"drives": await files.list_drives()}


@router.get("/quick")
async def get_quick_folders():
    return {"folders": await files.list_quick_folders(), "home": files.home_dir()}


class PickRequest(BaseModel):
    confirm: bool = True


@router.post("/pick")
async def pick_folder(req: PickRequest | None = None):
    return await files.pick_directory()


@router.patch("/mode")
async def set_mode(req: ModeRequest):
    if req.mode not in (files.SANDBOX_MODE, files.FULL_MODE):
        return {"ok": False, "error": "mode 必须是 sandbox 或 full"}
    files.set_access_mode(req.mode)
    return {"ok": True, "mode": files.get_access_mode()}
