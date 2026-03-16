from os import mkdir
from os.path import join
from json import dump, load
from datetime import datetime


def create(path: str, name: str):
    folder_path = join(path, name)
    mkdir(folder_path)

    app_path = join(folder_path, "App.proj")
    app_data = {
        "project": {
            "name": name,
            "version": "1.0.0",
            "create": datetime.now().strftime("%Y-%m-%d"),
            "main": "/Main.scs",
            "parameter": [],
        },
        "studio": {"version": "dev"},
    }
    with open(app_path, "w") as file:
        dump(app_data, file, ensure_ascii=False)

    create_flow_file(folder_path, "", "Main.scs")
    return app_path

def rename(app_path: str, name: str):
    with open(app_path, mode="r", encoding="utf-8") as file:
        app_data = load(file)
        app_data["project"]["name"] = name.strip()
    with open(app_path, "w") as file:
        dump(app_data, file, ensure_ascii=False)

def create_flow_file(path: str, name: str):
    file_path = join(path, f"{name}.scs")
    fs_data = {"local": [], "parameter": {"in": [], "out": []}, "body": []}
    with open(file_path, "w", encoding="utf-8") as file:
        dump(fs_data, file, ensure_ascii=False)
    return file_path
