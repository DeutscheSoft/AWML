/** @ignore */
export function fetchText(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) throw new Error(response.statusText);
    return response.text();
  });
}

/** @ignore */
export function fetchJSON(url) {
  return fetch(url).then(function (response) {
    if (!response.ok) throw new Error(response.statusText);
    return response.json();
  });
}

/** @ignore */
export function getCurrentWebSocketUrl() {
  if (typeof window === 'undefined' || !('location' in window))
    throw new Error('This method is only available in the browser.');

  const location = window.location;

  let href;

  if (location.protocol == 'http:') {
    href = 'ws://' + location.hostname;
    if (location.port != 80) href += ':' + location.port;
  } else if (location.protocol == 'https:') {
    href = 'wss://' + location.hostname;
    if (location.port != 443) href += ':' + location.port;
  } else {
    throw new Error('Unsupported protocol.');
  }

  return new URL(href);
}
