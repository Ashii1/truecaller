/**
 * Copyright 2018 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// If the loader is already loaded, just stop.
if (!self.define) {
  let registry = {};

  // Used for `eval` and `importScripts` where we can't get script URL by other means.
  // In both cases, it's safe to use a global var because those functions are synchronous.
  let nextDefineUri;

  const singleRequire = (uri, parentUri) => {
    uri = new URL(uri + ".js", parentUri).href;
    return registry[uri] || (
      
        new Promise(resolve => {
          if ("document" in self) {
            const script = document.createElement("script");
            script.src = uri;
            script.onload = resolve;
            document.head.appendChild(script);
          } else {
            nextDefineUri = uri;
            importScripts(uri);
            resolve();
          }
        })
      
      .then(() => {
        let promise = registry[uri];
        if (!promise) {
          throw new Error(`Module ${uri} didn’t register its module`);
        }
        return promise;
      })
    );
  };

  self.define = (depsNames, factory) => {
    const uri = nextDefineUri || ("document" in self ? document.currentScript.src : "") || location.href;
    if (registry[uri]) {
      // Module is already loading or loaded.
      return;
    }
    let exports = {};
    const require = depUri => singleRequire(depUri, uri);
    const specialDeps = {
      module: { uri },
      exports,
      require
    };
    registry[uri] = Promise.all(depsNames.map(
      depName => specialDeps[depName] || require(depName)
    )).then(deps => {
      factory(...deps);
      return exports;
    });
  };
}
define(['./workbox-7e5eb42b'], (function (workbox) { 'use strict';

  self.skipWaiting();
  workbox.clientsClaim();
  /**
   * The precacheAndRoute() method efficiently caches and responds to
   * requests for URLs in the manifest.
   * See https://goo.gl/S9QRab
   */
  workbox.precacheAndRoute([{
    "url": "pwa-maskable-512x512.png",
    "revision": "094b3fd844ecdef05bae79351b4ad9bd"
  }, {
    "url": "pwa-512x512.png",
    "revision": "bce20554e8993b2a85cf6a48c1195262"
  }, {
    "url": "pwa-192x192.png",
    "revision": "063bb800690a720549b75905cf0f954c"
  }, {
    "url": "index.html",
    "revision": "25c05f4d74ec9cd84c26bad8d3df8b7d"
  }, {
    "url": "icon.svg",
    "revision": "4c09570b411508a026fd2efc0584d0d9"
  }, {
    "url": "favicon.png",
    "revision": "cb9bbee744f80d29021778534ed8567f"
  }, {
    "url": "apple-touch-icon.png",
    "revision": "174a116a7dba790f75632d9eae4d69fb"
  }, {
    "url": "assets/workbox-window.prod.es5-BBnX5xw4.js",
    "revision": null
  }, {
    "url": "assets/react-core-k3tIzJ8W.js",
    "revision": null
  }, {
    "url": "assets/index-BrifY149.css",
    "revision": null
  }, {
    "url": "assets/index-BEJeUkfH.js",
    "revision": null
  }, {
    "url": "apple-touch-icon.png",
    "revision": "174a116a7dba790f75632d9eae4d69fb"
  }, {
    "url": "favicon.png",
    "revision": "cb9bbee744f80d29021778534ed8567f"
  }, {
    "url": "icon.svg",
    "revision": "4c09570b411508a026fd2efc0584d0d9"
  }, {
    "url": "pwa-192x192.png",
    "revision": "063bb800690a720549b75905cf0f954c"
  }, {
    "url": "pwa-512x512.png",
    "revision": "bce20554e8993b2a85cf6a48c1195262"
  }, {
    "url": "pwa-maskable-512x512.png",
    "revision": "094b3fd844ecdef05bae79351b4ad9bd"
  }, {
    "url": "manifest.webmanifest",
    "revision": "396ecc8252b88b800214174c9a922ece"
  }], {});
  workbox.cleanupOutdatedCaches();
  workbox.registerRoute(new workbox.NavigationRoute(workbox.createHandlerBoundToURL("index.html")));

}));
