Generic REST Console
====================

The Genetic REST Console is a HTML+JS view
designed to be served by RESTful services
as a (content-negotiated) alternative to their native (JSON or XML) views.

It is not meant for end-users of the service,
but rather for developers willing to debug or experiment with the service.

While equivalent functionalities can be obtained
with external services or browser extensions,
I believe that it is more convenient (and weby)
to integrate it to the service.

Bundling
--------

In order to ease the deployment,
a script (``bundle.py``) is provided
to bundle the whole console into a single file.

Future plans
------------

See the issue tracker (and feel free to contribute)
to suggest additional functionalities.
