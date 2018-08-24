#!/usr/bin/env python3
"""
A simple server for testing Gereco.

NB: content-negociation is naive; it honnors the first accepted content-type
"""
from functools import wraps
from html import escape
from os.path import exists, join
from traceback import format_exc

def utf8_encode(string_generator):
    """
    Decorator for converting an iterable of unicode strings
    into an iterable of UTF-8 byte-strings.
    """
    @wraps(string_generator)
    def wrapped(*args, **kw):
        for i in string_generator(*args, **kw):
            yield i.encode('utf8')
    return wrapped

def dump_exception(app):
    """
    Decorator f
    """
    @wraps(app)
    def wrapped(environ, start_response):
        differed_status_line = None
        differed_headers = None
        def differed_start_response(status_line, headers):
            nonlocal differed_status_line, differed_headers
            differed_status_line = status_line
            differed_headers = headers

        try:
            body = list(app(environ, differed_start_response))
            start_response(differed_status_line, differed_headers)
            return body
        except:
            start_response('500 Exception raised by application', [
                ('content-type', 'text/plain'),
            ])
            return ['Exception occured on server:\n\n', format_exc()]
    return wrapped


@utf8_encode
@dump_exception
def application(environ, start_response):
    """
    Main WSGI application (hanlde HTTP requests).
    """
    filename = environ['PATH_INFO'].split('/')[-1]
    if filename == "":
        filename = "index.html"
        
    if exists(filename):
        return local_file(filename, start_response)
    elif filename == '@debug':
        return debug(environ, start_response)
    elif environ['REQUEST_METHOD'] in ['HEAD', 'GET']:
        return gen_dummy(environ, start_response)
    else:
        return echo(environ, start_response)
        


def local_file(filename, start_response):
    """
    Replies with a the content of the specified file.
    """
    try:
        ext = filename.rsplit('.', 1)[1]
    except IndexError:
        ext = ""
    ctype = EXT_CTYPE.get(ext, 'application/octet-stream')

    start_response('200 Ok', [
        ('content-type', ctype),
    ])
    with open(filename) as f:
        for line in f.readlines():
            yield line

EXT_CTYPE = {
    'html': 'text/html',
    'js': 'application/javascript',
    'css':'text/css',
}

def debug(environ, start_response):
    """
    Replies by dumping the WSGI environ.
    """
    start_response('200 Ok', [
        ('content-type', 'text/plain')
    ])
    keys = list(environ.keys())
    keys.sort()
    template = '{:<%s} {!r}\n' % max( len(key) for key in keys )
    
    for key in keys:
        yield template.format(key, environ[key])

def gen_dummy(environ, start_response):
    """
    Replies with dummy content.
    """
    request_method = environ['REQUEST_METHOD']
    ctype = extract_accepted_ctype(environ.get('HTTP_ACCEPT'))
    if ctype not in DUMMY_DATA:
        start_response('406 Not Acceptable', [])
        return []
    start_response('200 Ok', [
        ('content-type', ctype)
    ])
    if request_method == 'HEAD':
        return []
    else:
        return DUMMY_DATA.get(ctype)

def extract_accepted_ctype(accept):
    """
    Naive parsing of the Accept HTTP header.
    """
    if not accept:
        return 'application/json'
    else:
        accept = accept.split(';')[0].split(',')[0]
        if accept.endswith('*'):
            if accept == 'text/*':
                accept = 'text/plain'
            elif accept == 'x-gereco/*':
                accept = 'x-gereco/test'
            elif accept in ['application/*', '*/*']:
                accept = 'application/json'
        return accept
    

DUMMY_DATA = {
    "text/uri-list": "http://localhost:3000/foo\nhttp://localhost:3000/bar\n",
    "application/json": """    {
        "prop1": "foo",
        "prop2": "bar/baz",
        "prop3": "..",
    }\n""",
    "application/xml": """    <data>
        <prop1>foo</prop1>
        <prop2 href="bar/baz" />
        <prop3 href=".." />
    </data>\n""",
    "text/html": open('index.html').read(),
    "x-gereco/test": """<!DOCTYPE>
<html>
  <head>
    <title>x-gereco test</title>
    <style> p { color: darkGreen } </style>
    <script> console.log("x-gereco/text activated"); </script>
  </head>
  <body>
    <p>This text should be green</p>
    <pre id="response" class="error">This should be formatted as an error, following the current Gereco theme, which should be imported inside the iframe.</pre>
    <a href="foo/bar">Internal link</a>
    <a target="_new" href="https://github.com/pchampin/gereco">External link</a>
  </body>
</html>
    """,
}

def echo(environ, start_response):
        content_length = int(environ.get('CONTENT_LENGTH') or '0')
        body = environ['wsgi.input'].read(content_length)

        start_response('200 Ok', [
            ('content-type', 'text/plain')
        ])
        yield 'Your request: {} {}\n\n'.format(
            environ['REQUEST_METHOD'],
            environ.get('HTTP_CONTENT_TYPE', 'application/json'),
        )
        yield body.decode('utf-8')
                                
        
    

from wsgiref.simple_server import make_server
HOST = 'localhost'
PORT = 3000
SERVER = make_server(HOST, PORT, application)
print("Listening on http://{}:{}/ ...".format(HOST, PORT))
SERVER.serve_forever()
