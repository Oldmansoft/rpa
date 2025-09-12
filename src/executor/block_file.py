from typing import List
from abc import ABC, abstractmethod
from enum import Enum
from os.path import isdir, join, isfile, getsize
from os import SEEK_END

class BlockMode(Enum):
    Read = 0
    Write = 1

class BlockFile:
    def __init__(self, folder_path: str, file_name: str, mode: BlockMode = BlockMode.Read):
        if not isdir(folder_path):
            raise NotADirectoryError(folder_path)
        self.number_length = 4
        self.byteorder = "big"
        self.index_file_path = join(folder_path, f"{file_name}.{self.number_length}ix")
        self.content_file_path = join(folder_path, file_name)
        self.mode = mode
        if self.mode == BlockMode.Read:
            self.file = Reader(self)
        else:
            self.file = Writer(self)

    def __enter__(self):
        return self.file

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.file.close()

class Block(ABC):
    def __init__(self, caller: BlockFile):
        self.caller = caller

    @abstractmethod
    def count(self) -> int:
        pass
    
    @abstractmethod
    def close(self) -> None:
        pass

class Writer(Block):
    def __init__(self, caller: BlockFile):
        self.index = 0
        self.content_start_position = 0
        if isfile(caller.index_file_path) and isfile(caller.content_file_path):
            self.index = int(getsize(caller.index_file_path) / caller.number_length)
            self.index_file = open(caller.index_file_path, "r+b")
            self.content_file = open(caller.content_file_path, "r+b")

            if self.index > 0:
                self.index_file.seek(-caller.number_length, SEEK_END)
                self.content_start_position = int.from_bytes(self.index_file.read(caller.number_length), caller.byteorder)
        else:
            self.index_file = open(caller.index_file_path, "wb")
            self.content_file = open(caller.content_file_path, "wb")
        super().__init__(caller)
    
    def count(self) -> int:
        return self.index

    def close(self) -> None:
        self.index_file.close()
        self.content_file.close()

    def append(self, content: bytes) -> None:
        content_length = len(content)
        content_finish_position = self.content_start_position + content_length
        if self.index > 0:
            self.index_file.seek(self.index * 4)
        self.index_file.write(content_finish_position.to_bytes(self.caller.number_length, self.caller.byteorder))
        self.index_file.flush()
        
        if self.content_start_position > 0:
            self.content_file.seek(self.content_start_position)
        self.content_file.write(content)
        self.content_file.flush()

        self.index = self.index + 1
        self.content_start_position = content_finish_position

    def __len__(self) -> int:
        return self.count()

class Reader(Block):
    def __init__(self, caller: BlockFile):
        self.length = None
        if isfile(caller.index_file_path) and isfile(caller.content_file_path):
            self.index_file = open(caller.index_file_path, "rb")
            self.content_file = open(caller.content_file_path, "rb")
        else:
            self.index_file = None
            self.content_file = None
        super().__init__(caller)
    
    def count(self) -> int:
        if self.index_file is None:
            self.length = 0
        else:
            self.length = int(self.index_file.seek(0, SEEK_END) / self.caller.number_length)
        return self.length
    
    def close(self) -> None:
        if self.index_file is None:
            return
        self.index_file.close()
        self.content_file.close()
    
    def get(self, index: int) -> bytes:
        if self.length is None:
            self.count()
        if index < 0:
            index = self.length + index
        if index < 0 or index >= self.length:
            raise IndexError("index out of range")
        
        content_start_position = 0
        if index > 0:
            self.index_file.seek((index - 1) * self.caller.number_length)
            content_start_position = int.from_bytes(self.index_file.read(self.caller.number_length), self.caller.byteorder)
            self.index_file.seek(index * self.caller.number_length)
        else:
            self.index_file.seek(0)
        content_finish_postion = int.from_bytes(self.index_file.read(self.caller.number_length), self.caller.byteorder)
        self.content_file.seek(content_start_position)
        content = self.content_file.read(content_finish_postion - content_start_position)
        return content
    
    def list(self, start: int = None, count: int = None) -> List[bytes]:
        if self.length is None:
            self.count()
        if start is None:
            start = 0
        if start < 0:
            start = self.length + start
            if start < 0:
                start = 0
        if start == 0 and self.length == 0:
            return []
        if start >= self.length:
            return []
        if count is None or count < 1 or start + count > self.length:
            count = self.length - start

        index = start
        content_start_position = 0
        if index > 0:
            self.index_file.seek((index - 1) * self.caller.number_length)
            content_start_position = int.from_bytes(self.index_file.read(self.caller.number_length), self.caller.byteorder)
            self.index_file.seek(index * self.caller.number_length)
        else:
            self.index_file.seek(0)
        self.content_file.seek(content_start_position)

        result = []
        for i in range(count):
            content_finish_postion = int.from_bytes(self.index_file.read(self.caller.number_length), self.caller.byteorder)
            content = self.content_file.read(content_finish_postion - content_start_position)
            result.append(content)

            content_start_position = content_finish_postion
        return result

    def __len__(self) -> int:
        if self.index_file is None:
            self.length = 0
        else:
            self.length = int(self.index_file.seek(0, SEEK_END) / self.caller.number_length)
        return self.length
