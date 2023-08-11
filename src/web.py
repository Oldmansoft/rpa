from flask import Flask, redirect
from flask_socketio import SocketIO, emit
from uuid import uuid4
from json import dumps

app = Flask('studio')
app.secret_key = str(uuid4())
socket = SocketIO(app)
socket.init_app(app, cors_allowed_origins='*')


def background_thread():
    count = 0
    while count < 5:
        socket.sleep(3)
        count += 1
        socket.emit(
            'message', {'data': 'Server generated event', 'count': count})


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
    return [
        {
            'category': 'group',
            'name': '程序设计',
            'list': [
                {
                    'category': 'item',
                    'id': 'Assign',
                    'type': 'unit',
                    'name': '赋值',
                    'params': [
                        {
                            'id': 'name',
                            'name': '目标',
                            'type': 'Variable'
                        },
                        {
                            'id': 'value',
                            'name': '值',
                            'type': 'Format'
                        }
                    ],
                    'format': '将{name}设置为{value}'
                },
                {
                    'category': 'item',
                    'id': 'Print',
                    'type': 'unit',
                    'name': '打印',
                    'params': [
                        {
                            'id': 'content',
                            'name': '内容',
                            'type': 'Format'
                        }
                    ],
                    'format': '{content}'
                },
                {
                    'category': 'item',
                    'id': 'While',
                    'type': 'action',
                    'name': '循环',
                    'params': [
                        {
                            'id': 'condition',
                            'name': '条件',
                            'type': 'Expression'
                        }
                    ],
                    'format': '{condition}'
                },
                {
                    'category': 'item',
                    'id': 'If',
                    'type': 'action',
                    'name': '如果',
                    'params': [
                        {
                            'id': 'condition',
                            'name': '条件',
                            'type': 'Expression'
                        }
                    ],
                    'format': '{condition}',
                    'more': {
                        'ElseIf': {
                            'type': '?',
                            'name': '否则如果',
                            'params': [
                                {
                                    'id': 'condition',
                                    'name': '判断',
                                    'type': 'Expression'
                                }
                            ],
                            'format': '{condition}'
                        },
                        'Else': {
                            'type': '+',
                            'name': '否则'
                        }
                    }
                }
            ]
        }
    ]


if __name__ == '__main__':
    socket.run(app)
