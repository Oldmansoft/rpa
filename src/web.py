import flask

app = flask.Flask('studio')

@app.route('/')
def index():
    return flask.redirect('/static/studio.htm')

app.run()