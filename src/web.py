from flask import Flask, redirect
from flask_socketio import SocketIO, emit
from uuid import uuid4
from json import dumps
import executor.component

app = Flask('studio')
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
    print('client connected.')
    socket.start_background_task(background_thread)
    emit('message', {'data': 'Connected', 'count': 0})

@socket.on('disconnect')
def disconnect_msg():
    print('client disconnected.')

@socket.on('message')
def handle_message(data):
    print(f'received message: {data}')

@app.route('/')
def index():
    return redirect('/static/studio.htm')

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

if __name__ == '__main__':
    socket.run(app)