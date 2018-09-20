// jshint browser:true, devel: true

(function() {
    window.addEventListener("load", function() {
        var base = document.getElementsByTagName("base")[0],
            addressbar = document.getElementById("addressbar"),
            methodCombo = document.getElementById("method"),
            methodInput = methodCombo.children[0],
            methodSelect = methodCombo.children[1],
            ctypeCombo = document.getElementById("ctype"),
            ctypeInput = ctypeCombo.children[0],
            ctypeSelect = ctypeCombo.children[1],
            send = document.getElementById("send"),
            payload = document.getElementById("payload"),
            response = document.getElementById("response"),
            loading = document.getElementById("loading"),
            responseHeaders = document.getElementById("response-headers"),
            hjsonToolbar = document.getElementById("hjson-toolbar"),
            tohjson = document.getElementById("tohjson"),
            fromhjson = document.getElementById("fromhjson"),
            etag = null,
            req = null,
            enhancing = null;

        // define functions

        function updateCombo(evt) {
            var select = evt.target;
            var input = evt.target.parentNode.children[0];
            var val = select.selectedOptions[0].value;
            if (val === "custom") {
                input.disabled = false;
                input.focus();
            } else {
                input.value = val;
                input.disabled = true;
            }
            if (evt.target === methodSelect) {
                payload.disabled = (val === "GET" || val === "DELETE");
                if (val === "PUT") {
                    payload.value = response.textContent;
                }
            }
        }

        function enhanceContent(elements, ctype, i) {
            enhancing = null;
            if (i < elements.length) {
                var elt = elements[i];
                var html = elt.innerHTML;
                if (/json/.test(ctype) || /html/.test(ctype) || /xml/.test(ctype)) {
                    html = html.replace(/""/g, '<a href="">""</a>');
                    html = html.replace(/"([^">\n]+)"/g, '"<a href="$1">$1</a>"');
                } else if (/text\/uri-list/.test(ctype)) {
                    html = html.replace(/^.*$/gm, '<a href="$&">$&</a>');
                } else {
                    html = html.replace(/&lt;&gt;/g, '<a href="">&lt;&gt;</a>');
                    html = html.replace(/&lt;([^\n]+?)&gt;/g, '&lt;<a href="$1">$1</a>&gt;');
                }
                elt.innerHTML = html;
                enhancing = setTimeout(enhanceContent.bind(self, elements, ctype, i+1), 0);
            }
        }

        function updateCtypeSelect(newCtype) {
            var options = ctypeSelect.children;
            for(var i=0; i<options.length; i++) {
                if (options[i].value === newCtype) {
                    ctypeSelect.selectedIndex = i;
                    break;
                } else if (options[i].value === "custom") {
                    ctypeSelect.selectedIndex = i;
                    ctypeInput.value = newCtype;
                }
            }
            updateCombo({ target: ctypeSelect });
        }


        function sendRequest(evt) {
            if (!evt) evt = {};
            if (evt.forceget) {
                // unless ran as the Send event handler, force GET
                methodSelect.selectedIndex = 0;
                updateCombo({ target: methodSelect });
            }
            if (req !== null) {
                req.abort();
                console.log("aborting previous request");
            }
            req = new XMLHttpRequest(),
                method = methodInput.value || "GET",
                url = addressbar.value;
            base.href = addressbar.value;
            url = url.split("#", 1)[0];
            if (method === "GET" || method === "HEAD") {
                // use JQuery hack to prevent cache
                var uncache = "_=" + Number(new Date());
                if (/\?/.test(addressbar.value)) {
                    url += "&" + uncache;
                } else {
                    url += "?" + uncache;
                }
            }
            req.withCredentials = true;
            req.open(method, url);

            var accept = "application/json;q=0.8,*/*;q=0.1";
            if (sessionStorage.lastAcceptedCType) {
                accept = sessionStorage.lastAcceptedCType + ';q=0.9,' + accept;
            }
            if (ctypeInput.value && ctypeInput.value !== '*/*') {
                sessionStorage.lastAcceptedCType = ctypeInput.value;
                accept = ctypeInput.value + ',' + accept;
            }
            req.setRequestHeader("accept", accept);

            if (method !== "GET") {
                req.setRequestHeader("content-type", ctypeInput.value);
            }
            if (method === "PUT" || method === "DELETE") {
                if (etag) {
                    req.setRequestHeader("if-match", etag);
                }
            }
            if (!evt.poppingState && String(window.location) !== addressbar.value) {
                try {
                    window.history.pushState({}, addressbar.value, addressbar.value);
                }
                catch(err) {
                    if (err.name !== "SecurityError") throw err;
                    // if this is just a SecurityError, then pushState with "safe" URL
                    var newUrl = String(window.location).split("#", 1)[0];
                    newUrl += "#" + addressbar.value ;
                    window.history.pushState({}, newUrl, newUrl);
                }
            }
            if (enhancing !== null) {
                //clearTimeout(enhancing);
            }
            response.textContent = "";
            response.classList.remove("error");
            response.classList.add("loading");
            response.appendChild(loading);
            responseHeaders.innerHTML = "";
            var oldLength = 0;
            var ctype;
            var remaining = "";

            req.onreadystatechange = function() {
                if (req.readyState === 2) {
                    //console.log("received header");

                    // display response headers
                    req.getAllResponseHeaders().split("\n").forEach(function(rh) {
                        if (!rh) return;
                        var match = /([^:]+): *(.*)/.exec(rh);
                        var key = match[1];
                        var val = match[2];

                        var row = responseHeaders.appendChild(document.createElement("tr"));
                        var th = row.appendChild(document.createElement("th"));
                        var td = row.appendChild(document.createElement("td"));

                        th.textContent = key;

                        // custom presentation of some header fields
                        if (/location/i.test(key)) {
                            var linka = td.appendChild(document.createElement("a"));
                            linka.href = val;
                            linka.textContent = val;
                        } else if (/link/i.test(key)) {
                            makeLinksIn(td, val);
                        } else {
                            td.textContent = val;
                        }
                    });

                    // additional processing of some response headers
                    if (Math.floor(req.status / 100) === 2) {
                        // etag
                        etag = req.getResponseHeader("etag");

                        // content-type
                        ctype = req.getResponseHeader("content-type");
                        if (ctype) {
                            updateCtypeSelect(ctype.split(";", 1)[0]);
                        }
                    }
                } else if (req.readyState >= 3) {
                    //console.log("received content part: " + req.responseText.substr(oldLength));
                    remaining += req.responseText.substr(oldLength);
                    oldLength = req.responseText.length;
                    var lines = remaining.split('\n');
                    if (lines.length && remaining[-1] !== '\n') {
                        remaining = lines.pop(-1);
                    } else {
                        remaining = "";
                    }
                    for (var i=0; i<lines.length; i+=1) {
                        var line = lines[i];
                        var span = document.createElement('span');
                        span.textContent = line + '\n';
                        response.appendChild(span);
                    }

                    if (req.readyState === 4) {
                        //console.log("received end of response");
                        if (remaining) {
                            var span = document.createElement('span');
                            span.textContent = remaining;
                            response.appendChild(span);
                        }
                        response.classList.remove("loading");
                        response.removeChild(loading);
                        document.title = "REST Console - " + addressbar.value;
                        enhanceContent(response.children, ctype, 0);
                        if (Math.floor(req.status / 100) === 2) {
                            response.classList.remove("error");
                            if (req.getResponseHeader("content-type").startsWith('x-gereco') &&
                                  // only trust x-gereco/* mime-types if they come from the same server
                                  addressbar.value === window.location.toString()) {
                                var iframe = document.createElement('iframe');
                                iframe.seamless = true;
                                iframe.scrolling = "no";
                                iframe.onload = function() {
                                    var ifdoc = iframe.contentDocument;
                                    iframe.style.height = (ifdoc.body.scrollHeight+32) + 'px';
                                    iframe.style.width = (ifdoc.body.scrollWidth+32) + 'px';
                                    var theme = document.querySelector('style#theme');
                                    ifdoc.head.insertBefore(
                                        theme.cloneNode(true),
                                        ifdoc.head.children[0]
                                    );

                                    ifdoc.body.addEventListener("click", interceptLinks);
                                };
                                iframe.srcdoc = req.responseText;
                                response.textContent = "";
                                response.appendChild(iframe);
                            }
                        } else {
                            response.classList.add("error");
                            if (req.statusText) {
                                response.textContent =
                                    req.status + " " + req.statusText + "\n\n" +
                                    req.responseText;
                            } else {
                                response.textContent = "Can not reach " + addressbar.value;
                            }
                        }
                        req = null;
                        }
                }
            };
            if (payload.disabled) req.send();
            else req.send(payload.value);
        }

        function interceptLinks (evt) {
            if (evt.target.nodeName === "A" &&
                  !evt.ctrlKey &&
                  (!evt.target.target || evt.target.target === '_self')) {
                evt.preventDefault();
                addressbar.value = evt.target.href;
                sendRequest({ forceget: true });
            }
        }

        function updateAddressBar() {
            if (window.location.hash) {
                addressbar.value = window.location.hash.substr(1);
            } else {
                addressbar.value = window.location;
            }
        }

        function makeLinksIn(td, links) {
          var ul = td.appendChild(document.createElement("ul"));
          var li = null;
          // the split below is not absolutely robust, but it should work in most cases
          for (link of links.substr(1).split(/, *</)) {
            if (li) { li.appendChild(document.createTextNode(",")); }
            li = ul.appendChild(document.createElement("li"));
            li.appendChild(document.createTextNode("<"));
            var cutpoint = link.search(">");
            var url = link.substr(0, cutpoint);
            var a = li.appendChild(document.createElement("a"));
            a.href = url;
            a.textContent = url;
            li.appendChild(document.createTextNode(link.substr(cutpoint)));
          }
        }

        // add event listeners

        window.addEventListener("popstate", function(e) {
            updateAddressBar();
            sendRequest({ forceget: true, poppingState: true });
        });

        window.addEventListener("keydown", function(evt) {
            if (evt.keyCode === 13 && evt.ctrlKey) { // ctrl+enter
                sendRequest();
            }
        });

        addressbar.addEventListener("keypress", function(evt) {
            if (evt.keyCode === 13) { // enter
                sendRequest({ forceget: true });
            }
        });

        payload.addEventListener("keydown", function(evt) {
            if (evt.keyCode === 9) { // tab
                // TODO insert  "   " properly
                evt.preventDefault();
            }
        });


        methodSelect.addEventListener("change", updateCombo);
        ctypeSelect.addEventListener("change", updateCombo);
        send.addEventListener("click", sendRequest);
        response.addEventListener("click", interceptLinks);
        responseHeaders.addEventListener("click", interceptLinks);

        // H-Json

        function checkHjson() {
            if (ctypeInput.value.search(/json/) != -1 && !payload.disabled) {
                hjsonToolbar.classList.remove("hidden");
            } else {
                hjsonToolbar.classList.add("hidden");
            }
        }

        ctypeInput.addEventListener('input', checkHjson);
        ctypeSelect.addEventListener('change', checkHjson);
        methodInput.addEventListener('input', checkHjson);
        methodSelect.addEventListener('change', checkHjson);

        tohjson.addEventListener("click", function(evt) {
            var data = Hjson.parse(payload.value);
            payload.value = Hjson.stringify(data);
        });

        fromhjson.addEventListener("click", function(evt) {
            var data = Hjson.parse(payload.value);
            payload.value = JSON.stringify(data, null, 2);
        });

        // do immediately on load

        updateAddressBar();
        updateCombo({ target: methodSelect });
        updateCombo({ target: ctypeSelect });
        sendRequest({ forceget: true });

    });
})();
