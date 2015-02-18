#!/usr/bin/env python

from re import compile as regex
from sys import stdout

CSS_IMPORT = regex(r"""@import url\(['"]([^'"]+)['"]\) *;""")
JS_SRC = regex(r"""src=['"]([^'"]+)['"] *> *</script>""")

with open('index.html') as fhtml:
    for line in fhtml.readlines():
        cssmatch = CSS_IMPORT.search(line)
        if cssmatch:
            cssfilename = cssmatch.groups()[0]
            stdout.write("/* importing {} */\n".format(cssfilename))
            with open(cssfilename) as fcss:
                for cssline in fcss.readlines():
                    stdout.write(cssline)
            continue

        jsmatch = JS_SRC.search(line)
        if jsmatch:
            jsfilename = jsmatch.groups()[0]
            stdout.write(">\n/* importing {} */\n".format(jsfilename))
            with open(jsfilename) as fjs:
                for jsline in fjs.readlines():
                    stdout.write(jsline)
                stdout.write("</script>\n")
            continue

        stdout.write(line)
