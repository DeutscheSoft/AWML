object port;

mapping connections = ([]);

void incoming(object frame, object from) {
    if (frame->opcode != Protocols.WebSocket.FRAME_TEXT) return;

    string data = frame->text;

    foreach (connections; object con;) if (con != from)
        con->send_text(data);
}

string file_to_mime(string name) {
    name = (name/".")[-1];
    switch (lower_case(name)) {
    case "html":
        return "text/html";
    case "css":
        return "text/css";
    case "png":
        return "image/png";
    case "jpg":
        return "image/jpeg";
    case "svg":
        return "image/svg+xml";
    case "js":
        return "application/x-javascript";
    default:
        return "application/octet-stream";
    }
}

void http_cb(object r) {
    string type = r->request_type;

    if (type == "GET") {
        string fname = r->not_query;

        fname = Stdio.simplify_path("./" + fname);

        fname = combine_path(getcwd(), fname);

        if (Stdio.is_dir(fname)) {
            if (!has_suffix(r->not_query, "/")) {
                r->response_and_finish(([
                    "error" : 301,
                    "extra_heads" : ([
                        "location" : r->not_query + "/",
                    ]),
                ]));
                return;
            }
            fname = combine_path(fname, "index.html");
        }

        if (Stdio.is_file(fname)) {

            r->response_and_finish(([
                "error" : 200,
                "file" : Stdio.File(fname, "r"),
                "type" : file_to_mime(fname)
            ]));
            return;
        }
    }

    r->response_and_finish(([ "error" : 404, "data" : "No such file.", "type" : "text/plain" ]));
}

void close_cb(mixed status, object con) {
    m_delete(connections, con);
}

void accept_cb(array(string) protocols, object request) {
    object con = request->websocket_accept("json");

    connections[con] = 1;

    con->onmessage = incoming;
    con->onclose = close_cb;
}

int main(int argc, array(string) argv) {

    int portno = (argc > 1) ? (int)argv[1] : 8080;

    port = Protocols.WebSocket.Port(http_cb, accept_cb, portno);

    write("Go to http://localhost:%d/\n", portno);

    return -1;
}
