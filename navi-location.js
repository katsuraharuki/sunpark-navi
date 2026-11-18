(function () {
  'use strict';

  const button = document.getElementById('location-toggle');
  const status = document.getElementById('location-status');
  const details = document.getElementById('location-details');
  const coordinates = document.getElementById('location-coordinates');
  const accuracy = document.getElementById('location-accuracy');
  const updated = document.getElementById('location-updated');
  const freshForMs = 30000;
  let session = null;
  let expiry = null;
  let latestTimestamp = null;

  function clearFix() {
    clearTimeout(expiry);
    expiry = null;
    latestTimestamp = null;
    details.hidden = true;
    coordinates.textContent = '';
    accuracy.textContent = '';
    updated.textContent = '';
  }

  function stop(message) {
    const previous = session;
    session = null;
    if (previous && previous.id !== null) navigator.geolocation.clearWatch(previous.id);
    clearFix();
    button.textContent = '端末の位置を測る';
    status.textContent = message;
  }

  function receivePosition(position) {
    const { latitude, longitude, accuracy: meters } = position.coords;
    const timestamp = position.timestamp;
    if (!Number.isFinite(timestamp) || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
        !Number.isFinite(meters) || meters < 0 || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      if (latestTimestamp === null) status.textContent = '有効な位置情報を取得できません。次の更新を待っています。';
      return;
    }
    const age = Date.now() - timestamp;
    if (age >= freshForMs) {
      if (latestTimestamp === null) status.textContent = '新しい位置情報を待っています。';
      return;
    }
    if (latestTimestamp !== null && timestamp < latestTimestamp) return;

    latestTimestamp = timestamp;
    coordinates.textContent = '緯度 ' + latitude.toFixed(5) + '° ／ 経度 ' + longitude.toFixed(5) + '°';
    accuracy.textContent = '測位精度 ±' + Math.ceil(meters).toLocaleString('ja-JP') + ' m';
    updated.textContent = '測位時刻 ' + new Date(timestamp).toLocaleTimeString('ja-JP');
    details.hidden = false;
    if (status.textContent !== '端末の位置を更新中です。') status.textContent = '端末の位置を更新中です。';

    clearTimeout(expiry);
    expiry = setTimeout(function () {
      clearFix();
      status.textContent = '位置情報の更新が途切れました。新しい位置情報を待っています。';
    }, freshForMs - Math.max(0, age));
  }

  function receiveError(error) {
    if (error.code === 1) {
      stop('位置情報が許可されていません。ブラウザのサイト設定で許可してから、もう一度お試しください。');
      return;
    }
    clearFix();
    status.textContent = error.code === 3
      ? '位置の取得に時間がかかっています。次の更新を待っています。'
      : '位置を取得できません。端末の位置情報設定を確認してください。';
  }

  button.addEventListener('click', function () {
    if (session) {
      stop('位置の更新を停止しました。');
      return;
    }
    if (!window.isSecureContext) {
      status.textContent = '位置情報を使うには、HTTPSでこのページを開いてください。';
      return;
    }
    if (!navigator.geolocation) {
      status.textContent = 'このブラウザでは位置情報を取得できません。';
      return;
    }

    const current = { id: null };
    session = current;
    button.textContent = '位置の更新を止める';
    status.textContent = '位置情報の許可と最初の測位を待っています。';
    try {
      current.id = navigator.geolocation.watchPosition(
        function (position) {
          if (session === current) receivePosition(position);
        },
        function (error) {
          if (session === current) receiveError(error);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
      );
    } catch {
      stop('位置情報を開始できません。ブラウザのサイト設定を確認してください。');
    }
  });

  window.addEventListener('pagehide', function () {
    if (session) stop('位置の更新を停止しました。');
  });
}());
