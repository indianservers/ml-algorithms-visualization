export function stopMediaStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach(track => {
    if (track.readyState !== 'ended') track.stop();
  });
}

export function detachMediaStream(element: HTMLMediaElement | null | undefined) {
  if (!element) return;
  element.pause();
  element.srcObject = null;
  element.removeAttribute('src');
  element.load();
}

export function stopMediaElementStream(element: HTMLMediaElement | null | undefined) {
  stopMediaStream(element?.srcObject as MediaStream | null);
  detachMediaStream(element);
}
