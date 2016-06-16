object port;

mapping connections = ([]);

mapping(int:mixed) values = ([]);
mapping(string:int) path2id = ([]);
mapping(int:string) id2path = ([]);

int get_id(string name) {
    int id;

    while (has_index(id2path, id = random(sizeof(id2path)*2+1)));

    id2path[id] = name;
    path2id[name] = id;

    return id;
}

void incoming(object frame, object from) {
    if (frame->opcode != Protocols.WebSocket.FRAME_TEXT) {
        werror("Received non text frame: %O\n", frame);
        return;
    }

    mixed data = Standards.JSON.decode(frame->text);

    if (mappingp(data)) {
        mapping(int:int) subscriptions = connections[from];
        mapping(string:int) ret = ([]);
        array updates = ({});

        foreach (data; string name;) {
            int id;
            if (!has_index(path2id, name)) {
                id = get_id(name);
            } else {
                id = path2id[name];
            }

            if (has_index(values, id)) {
                updates += ({ id, values[id] });
            }

            subscriptions[id] = 1;
            ret[name] = id;
        }

        from->send_text(Standards.JSON.encode(ret));
        if (sizeof(updates))
            from->send_text(Standards.JSON.encode(updates));

    } else if (arrayp(data)) {
        if (sizeof(data) & 1) {
            werror("Bad value change: %O\n", data);
            return;
        }

        array(string) changes = allocate(sizeof(data)/2);

        for (int i = 0; i < sizeof(data); i += 2) {
            int id = data[i];
            mixed value = data[i+1];

            values[id] = value;
            changes[i/2] = id;
        }
        
        foreach (connections; object con; mapping subscriptions) if (con != from) {
            array tmp = filter(changes, subscriptions);
            if (sizeof(tmp)) {
                array d = allocate(sizeof(tmp)*2);
                for (int i = 0; i < sizeof(tmp); i++) {
                    d[i*2] = tmp[i];
                    d[i*2+1] = values[tmp[i]];
                }
                con->send_text(Standards.JSON.encode(d));
            }
        }
    }
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
    case "mp3":
        return "audio/mpeg";
    case "wav":
        return "audio/wav";
    default:
        return "application/octet-stream";
    }
}

mapping(string:int) files = ([]);

void http_cb(object r) {
    string type = r->request_type;

    if (type == "GET" || type == "HEAD") {
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
            object file = Stdio.File(fname, "r");

            mapping response = ([
                "file" : file,
                "type" : file_to_mime(fname),
            ]);

            r->response_and_finish(response);
            return;
        }
    }

    werror("NOT FOUND: %O\n", r);
    r->response_and_finish(([ "error" : 404, "data" : "No such file.", "type" : "text/plain" ]));
}

void close_cb(mixed status, object con) {
    m_delete(connections, con);
}

void accept_cb(array(string) protocols, object request) {
    object con = request->websocket_accept("json");

    connections[con] = ([]);

    con->onmessage = incoming;
    con->onclose = close_cb;
}

void terminate() {
    write("Served the following list of file:\n");

    foreach (sort(indices(files));; string file) {
        write("%s\n", file);
    }

    exit(0);
}

int main(int argc, array(string) argv) {

    int portno = (argc > 1) ? (int)argv[1] : 8080;

    port = Protocols.WebSocket.Port(http_cb, accept_cb, portno);

    write("Go to http://localhost:%d/\n", portno);

    signal(signum("SIGINT"), terminate);

    return -1;
}
