from flask import Flask, redirect, request
from flask.wrappers import Response
from flask_socketio import SocketIO, emit
from gevent.pywsgi import WSGIServer
from geventwebsocket.handler import WebSocketHandler
from uuid import uuid4
from json import dumps, loads

import executor.component
import studio.client_message
import studio.project
from executor.log2 import Logger

app = Flask(__name__)
app.secret_key = str(uuid4())
socket = SocketIO(app)
socket.init_app(app, cors_allowed_origins='*')

def background_thread():
    count = 0
    while count < 5:
        socket.sleep(3)
        count += 1
        socket.emit('message', {'data': 'Server generated event', 'count': count})

@socket.on('connect')
def connected_msg():
    logger.info('socket client connected.')
    #socket.start_background_task(background_thread)
    #emit('message', {'data': 'Connected', 'count': 0})

@socket.on('disconnect')
def disconnect_msg():
    logger.info('socket client disconnected.')

def __handle_message_background_thread(name, action, kwargs) -> None:
    result = getattr(studio.client_message.messages[name], action)(**kwargs)
    socket.emit('message', {'callback': f'{name}.{action}', 'result': result})

@socket.on('message')
def handle_message(data):
    logger.info(f'socket received message: {data}')
    if not 'type' in data or not 'action' in data:
        logger.warning('缺少 type 或者 action')
        return '缺少 type 或者 action'
    kwargs = {}
    if 'params' in data:
        kwargs = data['params']
        if type(kwargs) != dict:
            logger.warning('params 内容无效')
            return 'params 内容无效'
    socket.start_background_task(__handle_message_background_thread, data['type'], data['action'], kwargs)

@app.route('/')
def index():
    return redirect('/static/start.htm')

@app.route('/get_message', methods=["POST"])
def get_message():
    binary_data = request.get_data()
    if len(binary_data) == 0:
        logger.warning('请求数据无效')
        return dumps({'code': 400, 'message': '请求数据无效', 'data': None}, ensure_ascii=False)
    
    data = loads(binary_data)
    if not 'type' in data or not 'action' in data:
        logger.warning('请求数据缺少 type 或者 action')
        return dumps({'code': 406, 'message': '请求数据缺少 type 或者 action', 'data': None}, ensure_ascii=False)
    kwargs = {}
    if 'params' in data:
        kwargs = data['params']
        if type(kwargs) != dict:
            logger.warning('请求数据 params 内容无效')
            return dumps({'code': 406, 'message': '请求数据 params 内容无效', 'data': None}, ensure_ascii=False)
    try:
        result = getattr(studio.client_message.messages[data['type']], data['action'])(**kwargs)
    except Exception as ex:
        return dumps({'code': 500, 'message': str(ex), 'data': None}, ensure_ascii=False)
    if result == None:
        return dumps({'code': 0, 'message': '', 'data': None})
    else:
        return dumps({'code': 0, 'message': '', 'data': result}, ensure_ascii=False)

@app.route('/get_component')
def component():
    groups = []
    items = []
    classes = executor.component.ActionComponent.__subclasses__()
    classes.extend(executor.component.ContainerComponent.__subclasses__())
    classes.extend(executor.component.CompositionComponent.__subclasses__())
    for class_type in classes:
        items.append(class_type().get_definition_content())
    
    program = {
        'category': 'group',
        'name': '程序设计',
        'list': items
    }
    groups.append(program)
    return groups

@app.after_request
def change_header(response:Response):
    disposition = response.get_wsgi_headers('environ').get('Content-Disposition') or ''
    if disposition.rfind('.js') == len(disposition) - 3:
        response.mimetype = 'application/javascript'
    return response

class SocketLogger(executor.component.Logger):
    def __init__(self, socket: SocketIO) -> None:
        self.socket = socket
    
    def write(self, index: int, content: str, name: str) -> None:
        self.socket.emit('message', {'write': content})

    def print(self, content: str) -> None:
        self.socket.emit('message', {'print': content})
    

if __name__ == '__main__':
    logger = Logger("服务端")
    studio.project.Project.Logger = SocketLogger(socket)
    socket.run(app)