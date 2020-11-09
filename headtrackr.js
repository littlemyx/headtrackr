/**
 * headtrackr library (https://www.github.com/auduno/headtrackr/)
 *
 * Copyright (c) 2012, Audun Mathias Øygard
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * This library includes code from Liu Liu's ccv library (https://github.com/liuliu/ccv)
 * and ported code from Benjamin Jung's FaceIt actionscript library (http://www.libspark.org/browser/as3/FaceIt/trunk/src/org/libspark/faceit/camshift/Tracker.as)
 *
 * ccv library license:
 *
 * Copyright (c) 2010, Liu Liu
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 *
 * * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * * Neither the name of the authors nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * FaceIt library license:
 *
 * Copyright (C)2009 Benjamin Jung
 *
 * Licensed under the MIT License
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

(function (root, factory) {
  if (typeof exports === "object") {
    module.exports = factory();
  } else if (typeof define === "function" && define.amd) {
    define([], factory);
  } else {
    root.headtrackr = factory();
  }
})(this, function () {
  /**
   * Wrapper for headtrackr library
   *
   * Usage:
   *	var htracker = new headtrackr.Tracker();
   *	htracker.init(videoInput, canvasInput);
   *	htracker.start();
   *
   * Optional parameters can be passed to Tracker like this:
   *	 new headtrackr.Tracker({ ui : false, altVideo : "somevideo.ogv" });
   *
   * Optional parameters:
   *	ui {boolean} : whether to create messageoverlay with messages like "found face" (default is true)
   *	altVideo {object} : urls to any alternative videos, if camera is not found or not supported
   *		the format is : {'ogv' : 'somevideo.ogv', 'mp4' : 'somevideo.mp4', 'webm' : 'somevideo.webm'}
   *	smoothing {boolean} : whether to use smoothing (default is true)
   *	debug {canvas} : pass along a canvas to paint output of facedetection, for debugging
   *	detectionInterval {number} : time we wait before doing a new facedetection (default is 20 ms)
   *	retryDetection {boolean} : whether to start facedetection again if we lose track of face (default is true)
   *	fov {number} : horizontal field of view of used camera in degrees (default is to estimate this)
   *	fadeVideo {boolean} : whether to fade out video when face is detected (default is false)
   *	cameraOffset {number} : distance from camera to center of screen, used to offset position of head (default is 11.5)
   *	calcAngles {boolean} : whether to calculate angles when doing facetracking (default is false)
   *	headPosition {boolean} : whether to calculate headposition (default is true)
   *
   * @author auduno / github.com/auduno
   */

  var headtrackr = {};
  headtrackr.rev = 2;

  /**
   * @constructor
   */
  headtrackr.Tracker = function (params) {
    if (!params) params = {};

    if (params.smoothing === undefined) params.smoothing = true;
    if (params.retryDetection === undefined) params.retryDetection = true;
    if (params.ui === undefined) params.ui = true;
    if (params.debug === undefined) {
      params.debug = false;
    } else {
      if (params.debug.tagName != "CANVAS") {
        params.debug = false;
      } else {
        var debugContext = params.debug.getContext("2d");
      }
    }
    if (params.detectionInterval === undefined) params.detectionInterval = 20;
    if (params.fadeVideo === undefined) params.fadeVideo = false;
    if (params.cameraOffset === undefined) params.cameraOffset = 11.5;
    if (params.calcAngles === undefined) params.calcAngles = false;
    if (params.headPosition === undefined) params.headPosition = true;

    var ui,
      smoother,
      facetracker,
      headposition,
      canvasContext,
      videoElement,
      detector;
    var detectionTimer;
    var fov = 0;
    var initialized = true;
    var run = false;
    var faceFound = false;
    var firstRun = true;
    var videoFaded = false;
    var headDiagonal = [];

    this.status = "";
    this.stream = undefined;

    var statusEvent = document.createEvent("Event");
    statusEvent.initEvent("headtrackrStatus", true, true);

    var headtrackerStatus = function (message) {
      statusEvent.status = message;
      document.dispatchEvent(statusEvent);
      this.status = message;
    }.bind(this);

    var insertAltVideo = function (video) {
      if (params.altVideo !== undefined) {
        if (supports_video()) {
          if (params.altVideo.ogv && supports_ogg_theora_video()) {
            video.src = params.altVideo.ogv;
          } else if (params.altVideo.mp4 && supports_h264_baseline_video()) {
            video.src = params.altVideo.mp4;
          } else if (params.altVideo.webm && supports_webm_video()) {
            video.src = params.altVideo.webm;
          } else {
            return false;
          }
          video.play();
          return true;
        }
      } else {
        return false;
      }
    };

    this.init = function (video, canvas, setupVideo) {
      if (setupVideo === undefined || setupVideo == true) {
        navigator.getUserMedia =
          navigator.getUserMedia ||
          navigator.webkitGetUserMedia ||
          navigator.mozGetUserMedia ||
          navigator.msGetUserMedia;
        window.URL =
          window.URL || window.webkitURL || window.msURL || window.mozURL;
        // check for camerasupport
        if ( navigator.mediaDevices.getUserMedia) {
          headtrackerStatus("getUserMedia");

          // chrome 19 shim
          var videoSelector = { video: true };
          if (window.navigator.appVersion.match(/Chrome\/(.*?) /)) {
            var chromeVersion = parseInt(
              window.navigator.appVersion.match(/Chrome\/(\d+)\./)[1],
              10
            );
            if (chromeVersion < 20) {
              videoSelector = "video";
            }
          }

          // opera shim
          if (window.opera) {
            window.URL = window.URL || {};
            if (!window.URL.createObjectURL)
              window.URL.createObjectURL = function (obj) {
                return obj;
              };
          }

          // set up stream

          navigator.mediaDevices.getUserMedia(videoSelector).then(function (stream) {
            headtrackerStatus("camera found");
            this.stream = stream;
            if (video.mozCaptureStream) {
              video.mozSrcObject = stream;
            } else {
              // video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
              const mediaStream = new MediaStream(stream);
              video.srcObject = mediaStream;
            }
            var button = document.getElementById("startPaly")
            button.addEventListener("click",()=>{
              video.play()
              .then((...args)=>{
                console.log(args)
              })
              .catch(error=>{
                console.log(error)
              });
            })
            
          }.bind(this)).catch(function () {
            headtrackerStatus("no camera");
            insertAltVideo(video);
          })


          // navigator.getUserMedia(
          //   videoSelector,
          //   function (stream) {
          //     headtrackerStatus("camera found");
          //     this.stream = stream;
          //     if (video.mozCaptureStream) {
          //       video.mozSrcObject = stream;
          //     } else {
          //       // video.src = (window.URL && window.URL.createObjectURL(stream)) || stream;
          //       const mediaStream = new MediaStream(stream);
          //       video.srcObject = mediaStream;
          //     }
          //     video.play();
          //   }.bind(this),
          //   function () {
          //     headtrackerStatus("no camera");
          //     insertAltVideo(video);
          //   }
          // );
        } else {
          headtrackerStatus("no getUserMedia");
          if (!insertAltVideo(video)) {
            return false;
          }
        }

        // resize video when it is playing
        video.addEventListener(
          "playing",
          function () {
            if (video.width > video.height) {
              video.width = 320;
            } else {
              video.height = 240;
            }
          },
          false
        );
      }

      videoElement = video;
      canvasElement = canvas;
      canvasContext = canvas.getContext("2d");

      // create ui if needed
      if (params.ui) {
        ui = new headtrackr.Ui();
      }

      // create smoother if enabled
      smoother = new headtrackr.Smoother(0.35, params.detectionInterval + 15);

      this.initialized = true;
    };

    var track = function () {
      // Copy video to canvas
      canvasContext.drawImage(
        videoElement,
        0,
        0,
        canvasElement.width,
        canvasElement.height
      );

      // if facetracking hasn't started, initialize facetrackr
      if (facetracker === undefined) {
        facetracker = new headtrackr.facetrackr.Tracker({
          debug: params.debug,
          calcAngles: params.calcAngles
        });
        facetracker.init(canvasElement);
      }

      // track face
      facetracker.track();
      var faceObj = facetracker.getTrackingObject({ debug: params.debug });

      if (faceObj.detection == "WB") headtrackerStatus("whitebalance");
      if (firstRun && faceObj.detection == "VJ") headtrackerStatus("detecting");

      // check if we have a detection first
      if (!(faceObj.confidence == 0)) {
        if (faceObj.detection == "VJ") {
          if (detectionTimer === undefined) {
            // start timing
            detectionTimer = new Date().getTime();
          }
          if (new Date().getTime() - detectionTimer > 5000) {
            headtrackerStatus("hints");
          }

          var x = faceObj.x + faceObj.width / 2; //midpoint
          var y = faceObj.y + faceObj.height / 2; //midpoint

          if (params.debug) {
            // draw detected face on debuggercanvas
            debugContext.strokeStyle = "#0000CC";
            debugContext.strokeRect(
              faceObj.x,
              faceObj.y,
              faceObj.width,
              faceObj.height
            );
          }
        }
        if (faceObj.detection == "CS") {
          var x = faceObj.x; //midpoint
          var y = faceObj.y; //midpoint

          if (detectionTimer !== undefined) detectionTimer = undefined;

          if (params.debug) {
            // draw tracked face on debuggercanvas
            debugContext.translate(faceObj.x, faceObj.y);
            debugContext.rotate(faceObj.angle - Math.PI / 2);
            debugContext.strokeStyle = "#00CC00";
            debugContext.strokeRect(
              -(faceObj.width / 2) >> 0,
              -(faceObj.height / 2) >> 0,
              faceObj.width,
              faceObj.height
            );
            debugContext.rotate(Math.PI / 2 - faceObj.angle);
            debugContext.translate(-faceObj.x, -faceObj.y);
          }

          // fade out video if it's showing
          if (!videoFaded && params.fadeVideo) {
            fadeVideo();
            videoFaded = true;
          }

          this.status = "tracking";

          //check if we've lost tracking of face
          if (faceObj.width == 0 || faceObj.height == 0) {
            if (params.retryDetection) {
              // retry facedetection
              headtrackerStatus("redetecting");

              facetracker = new headtrackr.facetrackr.Tracker({
                whitebalancing: false,
                debug: params.debug,
                calcAngles: params.calcAngles
              });
              facetracker.init(canvasElement);
              faceFound = false;
              headposition = undefined;

              // show video again if it's not already showing
              if (videoFaded) {
                videoElement.style.opacity = 1;
                videoFaded = false;
              }
            } else {
              headtrackerStatus("lost");
              this.stop();
            }
          } else {
            if (!faceFound) {
              headtrackerStatus("found");
              faceFound = true;
            }

            if (params.smoothing) {
              // smooth values
              if (!smoother.initialized) {
                smoother.init(faceObj);
              }
              faceObj = smoother.smooth(faceObj);
            }

            // get headposition
            if (headposition === undefined && params.headPosition) {
              // wait until headdiagonal is stable before initializing headposition
              var stable = false;

              // calculate headdiagonal
              var headdiag = Math.sqrt(
                faceObj.width * faceObj.width + faceObj.height * faceObj.height
              );

              if (headDiagonal.length < 6) {
                headDiagonal.push(headdiag);
              } else {
                headDiagonal.splice(0, 1);
                headDiagonal.push(headdiag);
                if (
                  Math.max.apply(null, headDiagonal) -
                    Math.min.apply(null, headDiagonal) <
                  5
                ) {
                  stable = true;
                }
              }

              if (stable) {
                if (firstRun) {
                  if (params.fov === undefined) {
                    headposition = new headtrackr.headposition.Tracker(
                      faceObj,
                      canvasElement.width,
                      canvasElement.height,
                      { distance_from_camera_to_screen: params.cameraOffset }
                    );
                  } else {
                    headposition = new headtrackr.headposition.Tracker(
                      faceObj,
                      canvasElement.width,
                      canvasElement.height,
                      {
                        fov: params.fov,
                        distance_from_camera_to_screen: params.cameraOffset
                      }
                    );
                  }
                  fov = headposition.getFOV();
                  firstRun = false;
                } else {
                  headposition = new headtrackr.headposition.Tracker(
                    faceObj,
                    canvasElement.width,
                    canvasElement.height,
                    {
                      fov: fov,
                      distance_from_camera_to_screen: params.cameraOffset
                    }
                  );
                }
                headposition.track(faceObj);
              }
            } else if (params.headPosition) {
              headposition.track(faceObj);
            }
          }
        }
      }

      if (run) {
        detector = requestAnimationFrame(track);
        // detector = window.setTimeout(track, params.detectionInterval);
      }
    }.bind(this);

    var starter = function () {
      // does some safety checks before starting

      // sometimes canvasContext is not available yet, so try and catch if it's not there...
      try {
        canvasContext.drawImage(
          videoElement,
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );

        // in some cases, the video sends events before starting to draw
        // so check that we have something on video before starting to track
        var canvasContent = headtrackr.getWhitebalance(canvasElement);
        if (canvasContent > 0) {
          run = true;
          track();
        } else {
          window.setTimeout(starter, 100);
        }
      } catch (err) {
        window.setTimeout(starter, 100);
      }
    };

    this.start = function () {
      // check if initialized
      if (!this.initialized) return false;

      // check if video is playing, if not, return false
      if (
        !(
          videoElement.currentTime > 0 &&
          !videoElement.paused &&
          !videoElement.ended
        )
      ) {
        run = true;
        //set event
        videoElement.addEventListener("playing", starter, false);

        return true;
      } else {
        starter();
      }

      return true;
    };

    this.stop = function () {
      window.clearTimeout(detector);
      run = false;
      headtrackerStatus("stopped");
      facetracker = undefined;
      faceFound = false;

      return true;
    };

    this.stopStream = function () {
      if (this.stream !== undefined) {
        this.stream.stop();
      }
    };

    this.getFOV = function () {
      return fov;
    };

    // fade out videoElement
    var fadeVideo = function () {
      if (videoElement.style.opacity == "") {
        videoElement.style.opacity = 0.98;
        window.setTimeout(fadeVideo, 50);
      } else if (videoElement.style.opacity > 0.3) {
        videoElement.style.opacity -= 0.02;
        window.setTimeout(fadeVideo, 50);
      } else {
        videoElement.style.opacity = 0.3;
      }
    };
  };

  // bind shim
  // from https://developer.mozilla.org/en/JavaScript/Reference/Global_Objects/Function/bind

  if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
      if (typeof this !== "function") {
        // closest thing possible to the ECMAScript 5 internal IsCallable function
        throw new TypeError(
          "Function.prototype.bind - what is trying to be bound is not callable"
        );
      }

      var aArgs = Array.prototype.slice.call(arguments, 1),
        fToBind = this,
        fNOP = function () {},
        fBound = function () {
          return fToBind.apply(
            this instanceof fNOP ? this : oThis || window,
            aArgs.concat(Array.prototype.slice.call(arguments))
          );
        };

      fNOP.prototype = this.prototype;
      fBound.prototype = new fNOP();

      return fBound;
    };
  }

  // video support utility functions

  function supports_video() {
    return !!document.createElement("video").canPlayType;
  }

  function supports_h264_baseline_video() {
    if (!supports_video()) {
      return false;
    }
    var v = document.createElement("video");
    return v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
  }

  function supports_ogg_theora_video() {
    if (!supports_video()) {
      return false;
    }
    var v = document.createElement("video");
    return v.canPlayType('video/ogg; codecs="theora, vorbis"');
  }

  function supports_webm_video() {
    if (!supports_video()) {
      return false;
    }
    var v = document.createElement("video");
    return v.canPlayType('video/webm; codecs="vp8, vorbis"');
  }
  /**
   * Viola-Jones-like face detection algorithm
   * Some explanation here: http://liuliu.me/eyes/javascript-face-detection-explained/
   *
   * @author Liu Liu / github.com/liuliu
   *
   * Copyright (c) 2010, Liu Liu
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
   *
   * * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
   * * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
   * * Neither the name of the authors nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *
   */

  headtrackr.ccv = {};

  headtrackr.ccv.grayscale = function (canvas) {
    /* detect_objects requires gray-scale image */
    var ctx = canvas.getContext("2d");
    var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    var data = imageData.data;
    var pix1,
      pix2,
      pix = canvas.width * canvas.height * 4;
    while (pix > 0)
      data[(pix -= 4)] = data[(pix1 = pix + 1)] = data[(pix2 = pix + 2)] =
        data[pix] * 0.3 + data[pix1] * 0.59 + data[pix2] * 0.11;
    ctx.putImageData(imageData, 0, 0);
    return canvas;
  };

  headtrackr.ccv.array_group = function (seq, gfunc) {
    var i, j;
    var node = new Array(seq.length);
    for (i = 0; i < seq.length; i++)
      node[i] = { parent: -1, element: seq[i], rank: 0 };
    for (i = 0; i < seq.length; i++) {
      if (!node[i].element) continue;
      var root = i;
      while (node[root].parent != -1) root = node[root].parent;
      for (j = 0; j < seq.length; j++) {
        if (
          i != j &&
          node[j].element &&
          gfunc(node[i].element, node[j].element)
        ) {
          var root2 = j;

          while (node[root2].parent != -1) root2 = node[root2].parent;

          if (root2 != root) {
            if (node[root].rank > node[root2].rank) node[root2].parent = root;
            else {
              node[root].parent = root2;
              if (node[root].rank == node[root2].rank) node[root2].rank++;
              root = root2;
            }

            /* compress path from node2 to the root: */
            var temp,
              node2 = j;
            while (node[node2].parent != -1) {
              temp = node2;
              node2 = node[node2].parent;
              node[temp].parent = root;
            }

            /* compress path from node to the root: */
            node2 = i;
            while (node[node2].parent != -1) {
              temp = node2;
              node2 = node[node2].parent;
              node[temp].parent = root;
            }
          }
        }
      }
    }
    var idx = new Array(seq.length);
    var class_idx = 0;
    for (i = 0; i < seq.length; i++) {
      j = -1;
      var node1 = i;
      if (node[node1].element) {
        while (node[node1].parent != -1) node1 = node[node1].parent;
        if (node[node1].rank >= 0) node[node1].rank = ~class_idx++;
        j = ~node[node1].rank;
      }
      idx[i] = j;
    }
    return { index: idx, cat: class_idx };
  };

  headtrackr.ccv.detect_objects = function (
    canvas,
    cascade,
    interval,
    min_neighbors
  ) {
    var scale = Math.pow(2, 1 / (interval + 1));
    var next = interval + 1;
    var scale_upto = Math.floor(
      Math.log(Math.min(cascade.width, cascade.height)) / Math.log(scale)
    );
    var pyr = new Array((scale_upto + next * 2) * 4);
    pyr[0] = canvas;
    pyr[0].data = pyr[0]
      .getContext("2d")
      .getImageData(0, 0, pyr[0].width, pyr[0].height).data;
    var i, j, k, x, y, q;
    for (i = 1; i <= interval; i++) {
      pyr[i * 4] = document.createElement("canvas");
      pyr[i * 4].width = Math.floor(pyr[0].width / Math.pow(scale, i));
      pyr[i * 4].height = Math.floor(pyr[0].height / Math.pow(scale, i));
      pyr[i * 4]
        .getContext("2d")
        .drawImage(
          pyr[0],
          0,
          0,
          pyr[0].width,
          pyr[0].height,
          0,
          0,
          pyr[i * 4].width,
          pyr[i * 4].height
        );
      pyr[i * 4].data = pyr[i * 4]
        .getContext("2d")
        .getImageData(0, 0, pyr[i * 4].width, pyr[i * 4].height).data;
    }
    for (i = next; i < scale_upto + next * 2; i++) {
      pyr[i * 4] = document.createElement("canvas");
      pyr[i * 4].width = Math.floor(pyr[i * 4 - next * 4].width / 2);
      pyr[i * 4].height = Math.floor(pyr[i * 4 - next * 4].height / 2);
      pyr[i * 4]
        .getContext("2d")
        .drawImage(
          pyr[i * 4 - next * 4],
          0,
          0,
          pyr[i * 4 - next * 4].width,
          pyr[i * 4 - next * 4].height,
          0,
          0,
          pyr[i * 4].width,
          pyr[i * 4].height
        );
      pyr[i * 4].data = pyr[i * 4]
        .getContext("2d")
        .getImageData(0, 0, pyr[i * 4].width, pyr[i * 4].height).data;
    }
    for (i = next * 2; i < scale_upto + next * 2; i++) {
      pyr[i * 4 + 1] = document.createElement("canvas");
      pyr[i * 4 + 1].width = Math.floor(pyr[i * 4 - next * 4].width / 2);
      pyr[i * 4 + 1].height = Math.floor(pyr[i * 4 - next * 4].height / 2);
      pyr[i * 4 + 1]
        .getContext("2d")
        .drawImage(
          pyr[i * 4 - next * 4],
          1,
          0,
          pyr[i * 4 - next * 4].width - 1,
          pyr[i * 4 - next * 4].height,
          0,
          0,
          pyr[i * 4 + 1].width - 2,
          pyr[i * 4 + 1].height
        );
      pyr[i * 4 + 1].data = pyr[i * 4 + 1]
        .getContext("2d")
        .getImageData(0, 0, pyr[i * 4 + 1].width, pyr[i * 4 + 1].height).data;
      pyr[i * 4 + 2] = document.createElement("canvas");
      pyr[i * 4 + 2].width = Math.floor(pyr[i * 4 - next * 4].width / 2);
      pyr[i * 4 + 2].height = Math.floor(pyr[i * 4 - next * 4].height / 2);
      pyr[i * 4 + 2]
        .getContext("2d")
        .drawImage(
          pyr[i * 4 - next * 4],
          0,
          1,
          pyr[i * 4 - next * 4].width,
          pyr[i * 4 - next * 4].height - 1,
          0,
          0,
          pyr[i * 4 + 2].width,
          pyr[i * 4 + 2].height - 2
        );
      pyr[i * 4 + 2].data = pyr[i * 4 + 2]
        .getContext("2d")
        .getImageData(0, 0, pyr[i * 4 + 2].width, pyr[i * 4 + 2].height).data;
      pyr[i * 4 + 3] = document.createElement("canvas");
      pyr[i * 4 + 3].width = Math.floor(pyr[i * 4 - next * 4].width / 2);
      pyr[i * 4 + 3].height = Math.floor(pyr[i * 4 - next * 4].height / 2);
      pyr[i * 4 + 3]
        .getContext("2d")
        .drawImage(
          pyr[i * 4 - next * 4],
          1,
          1,
          pyr[i * 4 - next * 4].width - 1,
          pyr[i * 4 - next * 4].height - 1,
          0,
          0,
          pyr[i * 4 + 3].width - 2,
          pyr[i * 4 + 3].height - 2
        );
      pyr[i * 4 + 3].data = pyr[i * 4 + 3]
        .getContext("2d")
        .getImageData(0, 0, pyr[i * 4 + 3].width, pyr[i * 4 + 3].height).data;
    }
    for (j = 0; j < cascade.stage_classifier.length; j++)
      cascade.stage_classifier[j].orig_feature =
        cascade.stage_classifier[j].feature;
    var scale_x = 1,
      scale_y = 1;
    var dx = [0, 1, 0, 1];
    var dy = [0, 0, 1, 1];
    var seq = [];
    for (i = 0; i < scale_upto; i++) {
      var qw = pyr[i * 4 + next * 8].width - Math.floor(cascade.width / 4);
      var qh = pyr[i * 4 + next * 8].height - Math.floor(cascade.height / 4);
      var step = [
        pyr[i * 4].width * 4,
        pyr[i * 4 + next * 4].width * 4,
        pyr[i * 4 + next * 8].width * 4
      ];
      var paddings = [
        pyr[i * 4].width * 16 - qw * 16,
        pyr[i * 4 + next * 4].width * 8 - qw * 8,
        pyr[i * 4 + next * 8].width * 4 - qw * 4
      ];
      for (j = 0; j < cascade.stage_classifier.length; j++) {
        var orig_feature = cascade.stage_classifier[j].orig_feature;
        var feature = (cascade.stage_classifier[j].feature = new Array(
          cascade.stage_classifier[j].count
        ));
        for (k = 0; k < cascade.stage_classifier[j].count; k++) {
          feature[k] = {
            size: orig_feature[k].size,
            px: new Array(orig_feature[k].size),
            pz: new Array(orig_feature[k].size),
            nx: new Array(orig_feature[k].size),
            nz: new Array(orig_feature[k].size)
          };
          for (q = 0; q < orig_feature[k].size; q++) {
            feature[k].px[q] =
              orig_feature[k].px[q] * 4 +
              orig_feature[k].py[q] * step[orig_feature[k].pz[q]];
            feature[k].pz[q] = orig_feature[k].pz[q];
            feature[k].nx[q] =
              orig_feature[k].nx[q] * 4 +
              orig_feature[k].ny[q] * step[orig_feature[k].nz[q]];
            feature[k].nz[q] = orig_feature[k].nz[q];
          }
        }
      }
      for (q = 0; q < 4; q++) {
        var u8 = [
          pyr[i * 4].data,
          pyr[i * 4 + next * 4].data,
          pyr[i * 4 + next * 8 + q].data
        ];
        var u8o = [
          dx[q] * 8 + dy[q] * pyr[i * 4].width * 8,
          dx[q] * 4 + dy[q] * pyr[i * 4 + next * 4].width * 4,
          0
        ];
        for (y = 0; y < qh; y++) {
          for (x = 0; x < qw; x++) {
            var sum = 0;
            var flag = true;
            for (j = 0; j < cascade.stage_classifier.length; j++) {
              sum = 0;
              var alpha = cascade.stage_classifier[j].alpha;
              var feature = cascade.stage_classifier[j].feature;
              for (k = 0; k < cascade.stage_classifier[j].count; k++) {
                var feature_k = feature[k];
                var p,
                  pmin =
                    u8[feature_k.pz[0]][u8o[feature_k.pz[0]] + feature_k.px[0]];
                var n,
                  nmax =
                    u8[feature_k.nz[0]][u8o[feature_k.nz[0]] + feature_k.nx[0]];
                if (pmin <= nmax) {
                  sum += alpha[k * 2];
                } else {
                  var f,
                    shortcut = true;
                  for (f = 0; f < feature_k.size; f++) {
                    if (feature_k.pz[f] >= 0) {
                      p =
                        u8[feature_k.pz[f]][
                          u8o[feature_k.pz[f]] + feature_k.px[f]
                        ];
                      if (p < pmin) {
                        if (p <= nmax) {
                          shortcut = false;
                          break;
                        }
                        pmin = p;
                      }
                    }
                    if (feature_k.nz[f] >= 0) {
                      n =
                        u8[feature_k.nz[f]][
                          u8o[feature_k.nz[f]] + feature_k.nx[f]
                        ];
                      if (n > nmax) {
                        if (pmin <= n) {
                          shortcut = false;
                          break;
                        }
                        nmax = n;
                      }
                    }
                  }
                  sum += shortcut ? alpha[k * 2 + 1] : alpha[k * 2];
                }
              }
              if (sum < cascade.stage_classifier[j].threshold) {
                flag = false;
                break;
              }
            }
            if (flag) {
              seq.push({
                x: (x * 4 + dx[q] * 2) * scale_x,
                y: (y * 4 + dy[q] * 2) * scale_y,
                width: cascade.width * scale_x,
                height: cascade.height * scale_y,
                neighbor: 1,
                confidence: sum
              });
            }
            u8o[0] += 16;
            u8o[1] += 8;
            u8o[2] += 4;
          }
          u8o[0] += paddings[0];
          u8o[1] += paddings[1];
          u8o[2] += paddings[2];
        }
      }
      scale_x *= scale;
      scale_y *= scale;
    }
    for (j = 0; j < cascade.stage_classifier.length; j++)
      cascade.stage_classifier[j].feature =
        cascade.stage_classifier[j].orig_feature;
    if (!(min_neighbors > 0)) return seq;
    else {
      var result = headtrackr.ccv.array_group(seq, function (r1, r2) {
        var distance = Math.floor(r1.width * 0.25 + 0.5);

        return (
          r2.x <= r1.x + distance &&
          r2.x >= r1.x - distance &&
          r2.y <= r1.y + distance &&
          r2.y >= r1.y - distance &&
          r2.width <= Math.floor(r1.width * 1.5 + 0.5) &&
          Math.floor(r2.width * 1.5 + 0.5) >= r1.width
        );
      });
      var ncomp = result.cat;
      var idx_seq = result.index;
      var comps = new Array(ncomp + 1);
      for (i = 0; i < comps.length; i++)
        comps[i] = {
          neighbors: 0,
          x: 0,
          y: 0,
          width: 0,
          height: 0,
          confidence: 0
        };

      // count number of neighbors
      for (i = 0; i < seq.length; i++) {
        var r1 = seq[i];
        var idx = idx_seq[i];

        if (comps[idx].neighbors == 0) comps[idx].confidence = r1.confidence;

        ++comps[idx].neighbors;

        comps[idx].x += r1.x;
        comps[idx].y += r1.y;
        comps[idx].width += r1.width;
        comps[idx].height += r1.height;
        comps[idx].confidence = Math.max(comps[idx].confidence, r1.confidence);
      }

      var seq2 = [];
      // calculate average bounding box
      for (i = 0; i < ncomp; i++) {
        var n = comps[i].neighbors;
        if (n >= min_neighbors)
          seq2.push({
            x: (comps[i].x * 2 + n) / (2 * n),
            y: (comps[i].y * 2 + n) / (2 * n),
            width: (comps[i].width * 2 + n) / (2 * n),
            height: (comps[i].height * 2 + n) / (2 * n),
            neighbors: comps[i].neighbors,
            confidence: comps[i].confidence
          });
      }

      var result_seq = [];
      // filter out small face rectangles inside large face rectangles
      for (i = 0; i < seq2.length; i++) {
        var r1 = seq2[i];
        var flag = true;
        for (j = 0; j < seq2.length; j++) {
          var r2 = seq2[j];
          var distance = Math.floor(r2.width * 0.25 + 0.5);

          if (
            i != j &&
            r1.x >= r2.x - distance &&
            r1.y >= r2.y - distance &&
            r1.x + r1.width <= r2.x + r2.width + distance &&
            r1.y + r1.height <= r2.y + r2.height + distance &&
            (r2.neighbors > Math.max(3, r1.neighbors) || r1.neighbors < 3)
          ) {
            flag = false;
            break;
          }
        }

        if (flag) result_seq.push(r1);
      }
      return result_seq;
    }
  };

  /**
   * Data for ccv facedetection
   *
   * @author Liu Liu / github.com/liuliu
   *
   * Copyright (c) 2010, Liu Liu
   * All rights reserved.
   *
   * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
   *
   * * Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
   * * Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
   * * Neither the name of the authors nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.
   *
   * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
   *
   */

  headtrackr.cascade = {
    count: 16,
    width: 24,
    height: 24,
    stage_classifier: [
      {
        count: 4,
        threshold: -4.57753,
        feature: [
          {
            size: 4,
            px: [3, 5, 8, 11],
            py: [2, 2, 6, 3],
            pz: [2, 1, 1, 0],
            nx: [8, 4, 0, 0],
            ny: [4, 4, 0, 0],
            nz: [1, 1, -1, -1]
          },
          {
            size: 3,
            px: [3, 6, 7],
            py: [7, 13, 0],
            pz: [1, 0, -1],
            nx: [2, 3, 4],
            ny: [5, 4, 4],
            nz: [2, 1, 1]
          },
          {
            size: 5,
            px: [5, 3, 10, 13, 11],
            py: [1, 0, 3, 2, 2],
            pz: [1, 2, 0, 0, 0],
            nx: [0, 11, 0, 11, 11],
            ny: [0, 2, 3, 1, 1],
            nz: [1, 1, 0, 1, -1]
          },
          {
            size: 5,
            px: [6, 12, 12, 9, 12],
            py: [4, 13, 12, 7, 11],
            pz: [1, 0, 0, 1, 0],
            nx: [8, 0, 8, 2, 11],
            ny: [4, 0, 8, 5, 1],
            nz: [1, -1, -1, -1, -1]
          }
        ],
        alpha: [
          -2.879683,
          2.879683,
          -1.569341,
          1.569341,
          -1.286131,
          1.286131,
          -1.157626,
          1.157626
        ]
      },
      {
        count: 4,
        threshold: -4.339908,
        feature: [
          {
            size: 5,
            px: [13, 12, 3, 11, 17],
            py: [3, 3, 1, 4, 13],
            pz: [0, 0, 2, 0, 0],
            nx: [4, 3, 8, 15, 15],
            ny: [4, 5, 4, 8, 8],
            nz: [1, 2, 1, 0, -1]
          },
          {
            size: 5,
            px: [6, 7, 6, 3, 3],
            py: [13, 13, 4, 2, 7],
            pz: [0, 0, 1, 2, 1],
            nx: [4, 8, 3, 0, 15],
            ny: [4, 4, 4, 3, 8],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 3,
            px: [2, 2, 11],
            py: [3, 2, 5],
            pz: [2, 2, 0],
            nx: [3, 8, 3],
            ny: [4, 4, 4],
            nz: [1, -1, -1]
          },
          {
            size: 5,
            px: [15, 13, 9, 11, 7],
            py: [2, 1, 2, 1, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [23, 11, 23, 22, 23],
            ny: [1, 0, 2, 0, 0],
            nz: [0, 1, 0, 0, 0]
          }
        ],
        alpha: [
          -2.466029,
          2.466029,
          -1.83951,
          1.83951,
          -1.060559,
          1.060559,
          -1.094927,
          1.094927
        ]
      },
      {
        count: 7,
        threshold: -5.052474,
        feature: [
          {
            size: 5,
            px: [17, 13, 3, 11, 10],
            py: [13, 2, 1, 4, 3],
            pz: [0, 0, 2, 0, 0],
            nx: [4, 8, 8, 3, 7],
            ny: [2, 8, 4, 5, 4],
            nz: [2, 0, 1, 2, 1]
          },
          {
            size: 5,
            px: [6, 7, 3, 6, 6],
            py: [4, 12, 2, 13, 14],
            pz: [1, 0, 2, 0, 0],
            nx: [8, 3, 4, 4, 3],
            ny: [4, 4, 2, 0, 2],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 5,
            px: [7, 4, 5, 3, 3],
            py: [2, 1, 3, 1, 1],
            pz: [0, 1, 0, 1, -1],
            nx: [1, 0, 1, 1, 0],
            ny: [1, 3, 2, 0, 4],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [11, 11, 11, 3, 2],
            py: [11, 13, 10, 7, 2],
            pz: [0, 0, 0, 1, 2],
            nx: [4, 1, 8, 2, 0],
            ny: [4, 1, 12, 0, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [9, 13, 1],
            py: [7, 19, 4],
            pz: [1, -1, -1],
            nx: [4, 7, 4],
            ny: [5, 8, 2],
            nz: [2, 1, 2]
          },
          {
            size: 5,
            px: [12, 8, 16, 4, 4],
            py: [12, 1, 2, 0, 0],
            pz: [0, 1, 0, 2, -1],
            nx: [11, 22, 11, 23, 23],
            ny: [2, 0, 1, 1, 5],
            nz: [1, 0, 1, 0, 0]
          },
          {
            size: 3,
            px: [11, 17, 17],
            py: [6, 11, 12],
            pz: [0, 0, 0],
            nx: [15, 1, 11],
            ny: [9, 1, 1],
            nz: [0, -1, -1]
          }
        ],
        alpha: [
          -2.15689,
          2.15689,
          -1.718246,
          1.718246,
          -9.651329e-1,
          9.651329e-1,
          -9.94809e-1,
          9.94809e-1,
          -8.802466e-1,
          8.802466e-1,
          -8.486741e-1,
          8.486741e-1,
          -8.141777e-1,
          8.141777e-1
        ]
      },
      {
        count: 13,
        threshold: -5.7744,
        feature: [
          {
            size: 5,
            px: [6, 10, 3, 12, 14],
            py: [5, 3, 1, 2, 2],
            pz: [1, 0, 2, 0, 0],
            nx: [3, 4, 14, 8, 4],
            ny: [5, 4, 8, 4, 2],
            nz: [2, 1, 0, 1, 2]
          },
          {
            size: 5,
            px: [10, 6, 11, 5, 12],
            py: [4, 13, 4, 2, 4],
            pz: [0, 0, 0, 1, 0],
            nx: [1, 4, 8, 1, 1],
            ny: [2, 4, 4, 4, 3],
            nz: [0, 1, 1, 0, 0]
          },
          {
            size: 3,
            px: [18, 6, 12],
            py: [12, 4, 8],
            pz: [0, 1, 0],
            nx: [7, 4, 8],
            ny: [4, 2, 4],
            nz: [1, -1, -1]
          },
          {
            size: 5,
            px: [7, 5, 6, 3, 17],
            py: [13, 12, 3, 8, 13],
            pz: [0, 0, 1, 1, 0],
            nx: [3, 3, 0, 1, 8],
            ny: [4, 5, 5, 10, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [16, 7, 16, 7, 7],
            py: [1, 1, 2, 0, 0],
            pz: [0, 1, 0, 1, -1],
            nx: [23, 23, 23, 11, 5],
            ny: [2, 14, 1, 2, 1],
            nz: [0, 0, 0, 1, 2]
          },
          {
            size: 3,
            px: [9, 18, 16],
            py: [7, 14, 2],
            pz: [1, 0, -1],
            nx: [8, 4, 9],
            ny: [10, 2, 4],
            nz: [1, 2, 1]
          },
          {
            size: 4,
            px: [3, 16, 1, 22],
            py: [7, 4, 5, 11],
            pz: [1, -1, -1, -1],
            nx: [3, 9, 4, 2],
            ny: [4, 9, 7, 5],
            nz: [1, 0, 1, 2]
          },
          {
            size: 5,
            px: [4, 7, 8, 8, 9],
            py: [0, 2, 2, 1, 1],
            pz: [1, 0, 0, 0, 0],
            nx: [0, 0, 1, 0, 0],
            ny: [15, 16, 19, 0, 14],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 5,
            px: [4, 4, 7, 8, 12],
            py: [2, 5, 6, 7, 10],
            pz: [2, 2, 1, 1, 0],
            nx: [8, 5, 10, 0, 0],
            ny: [4, 2, 5, 3, 14],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 0],
            py: [13, 4],
            pz: [0, -1],
            nx: [3, 14],
            ny: [4, 16],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [17, 8, 18, 4, 4],
            py: [3, 1, 3, 0, 0],
            pz: [0, 1, 0, 2, -1],
            nx: [21, 22, 5, 11, 22],
            ny: [0, 1, 0, 1, 2],
            nz: [0, 0, 2, 1, 0]
          },
          {
            size: 4,
            px: [7, 8, 2, 11],
            py: [13, 12, 2, 7],
            pz: [0, 0, 2, 0],
            nx: [4, 0, 23, 3],
            ny: [4, 1, 1, 11],
            nz: [1, -1, -1, -1]
          },
          {
            size: 5,
            px: [4, 18, 8, 9, 15],
            py: [4, 16, 7, 7, 23],
            pz: [2, 0, 1, 1, 0],
            nx: [0, 1, 1, 1, 1],
            ny: [10, 21, 23, 22, 22],
            nz: [1, 0, 0, 0, -1]
          }
        ],
        alpha: [
          -1.956565,
          1.956565,
          -1.262438,
          1.262438,
          -1.056941,
          1.056941,
          -9.712509e-1,
          9.712509e-1,
          -8.261028e-1,
          8.261028e-1,
          -8.456506e-1,
          8.456506e-1,
          -6.652113e-1,
          6.652113e-1,
          -6.026287e-1,
          6.026287e-1,
          -6.915425e-1,
          6.915425e-1,
          -5.539286e-1,
          5.539286e-1,
          -5.515072e-1,
          5.515072e-1,
          -6.685884e-1,
          6.685884e-1,
          -4.65607e-1,
          4.65607e-1
        ]
      },
      {
        count: 20,
        threshold: -5.606853,
        feature: [
          {
            size: 5,
            px: [17, 11, 6, 14, 9],
            py: [13, 4, 4, 3, 3],
            pz: [0, 0, 1, 0, 0],
            nx: [14, 4, 8, 7, 8],
            ny: [8, 4, 4, 4, 8],
            nz: [0, 1, 1, 1, 0]
          },
          {
            size: 5,
            px: [3, 9, 10, 11, 11],
            py: [7, 2, 2, 3, 3],
            pz: [1, 0, 0, 0, -1],
            nx: [3, 8, 4, 2, 5],
            ny: [4, 4, 10, 2, 8],
            nz: [1, 1, 1, 2, 1]
          },
          {
            size: 5,
            px: [12, 12, 12, 5, 12],
            py: [12, 9, 10, 12, 11],
            pz: [0, 0, 0, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [2, 1, 3, 0, 0],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [9, 18, 9, 9, 12],
            py: [7, 14, 19, 5, 11],
            pz: [1, -1, -1, -1, -1],
            nx: [23, 4, 23, 23, 8],
            ny: [13, 5, 14, 16, 4],
            nz: [0, 2, 0, 0, 1]
          },
          {
            size: 5,
            px: [12, 12, 12, 6, 1],
            py: [13, 11, 12, 6, 5],
            pz: [0, 0, 0, -1, -1],
            nx: [4, 6, 8, 4, 9],
            ny: [2, 8, 4, 4, 4],
            nz: [2, 1, 1, 1, 1]
          },
          {
            size: 4,
            px: [12, 11, 11, 6],
            py: [5, 5, 6, 13],
            pz: [0, 0, 0, 0],
            nx: [8, 3, 2, 8],
            ny: [4, 4, 17, 2],
            nz: [1, 1, -1, -1]
          },
          {
            size: 5,
            px: [3, 14, 12, 15, 13],
            py: [0, 2, 2, 2, 2],
            pz: [2, 0, 0, 0, 0],
            nx: [22, 23, 22, 23, 7],
            ny: [0, 3, 1, 2, 4],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [16, 15, 18, 19, 9],
            py: [12, 11, 12, 12, 9],
            pz: [0, 0, 0, 0, 1],
            nx: [8, 2, 22, 23, 21],
            ny: [4, 1, 1, 2, 20],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [4, 7, 7],
            py: [0, 2, 2],
            pz: [1, 0, -1],
            nx: [1, 2, 2],
            ny: [2, 0, 2],
            nz: [1, 0, 0]
          },
          {
            size: 3,
            px: [4, 11, 11],
            py: [6, 9, 8],
            pz: [1, 0, 0],
            nx: [9, 2, 8],
            ny: [9, 4, 5],
            nz: [0, -1, -1]
          },
          {
            size: 4,
            px: [2, 7, 6, 6],
            py: [4, 23, 21, 22],
            pz: [2, 0, 0, 0],
            nx: [9, 3, 8, 17],
            ny: [21, 2, 5, 1],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [2, 8],
            py: [4, 12],
            pz: [2, 0],
            nx: [3, 0],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [4, 5, 1, 8, 4],
            py: [15, 12, 3, 23, 12],
            pz: [0, 0, 2, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [23, 10, 22, 21, 11],
            nz: [0, 1, 0, 0, -1]
          },
          {
            size: 2,
            px: [21, 5],
            py: [13, 4],
            pz: [0, 2],
            nx: [23, 4],
            ny: [23, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [15, 17],
            py: [2, 3],
            pz: [0, 0],
            nx: [19, 20],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [12, 1, 8, 17, 4],
            py: [14, 2, 13, 6, 12],
            pz: [0, -1, -1, -1, -1],
            nx: [8, 13, 15, 15, 7],
            ny: [10, 9, 15, 14, 8],
            nz: [1, 0, 0, 0, 1]
          },
          {
            size: 2,
            px: [8, 5],
            py: [7, 4],
            pz: [1, -1],
            nx: [4, 13],
            ny: [2, 21],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [3, 4],
            py: [7, 0],
            pz: [1, -1],
            nx: [4, 2],
            ny: [7, 5],
            nz: [1, 2]
          },
          {
            size: 4,
            px: [4, 14, 3, 11],
            py: [3, 23, 2, 5],
            pz: [2, 0, 2, 0],
            nx: [7, 8, 2, 16],
            ny: [8, 0, 1, 15],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [9, 8],
            py: [0, 0],
            pz: [0, 0],
            nx: [2, 2],
            ny: [3, 5],
            nz: [2, 2]
          }
        ],
        alpha: [
          -1.95797,
          1.95797,
          -1.225984,
          1.225984,
          -8.310246e-1,
          8.310246e-1,
          -8.315741e-1,
          8.315741e-1,
          -7.973616e-1,
          7.973616e-1,
          -7.661959e-1,
          7.661959e-1,
          -6.042118e-1,
          6.042118e-1,
          -6.506833e-1,
          6.506833e-1,
          -4.808219e-1,
          4.808219e-1,
          -6.079504e-1,
          6.079504e-1,
          -5.163994e-1,
          5.163994e-1,
          -5.268142e-1,
          5.268142e-1,
          -4.935685e-1,
          4.935685e-1,
          -4.427544e-1,
          4.427544e-1,
          -4.053949e-1,
          4.053949e-1,
          -4.701274e-1,
          4.701274e-1,
          -4.387648e-1,
          4.387648e-1,
          -4.305499e-1,
          4.305499e-1,
          -4.042607e-1,
          4.042607e-1,
          -4.372088e-1,
          4.372088e-1
        ]
      },
      {
        count: 22,
        threshold: -5.679317,
        feature: [
          {
            size: 5,
            px: [11, 3, 17, 14, 13],
            py: [4, 0, 13, 2, 3],
            pz: [0, 2, 0, 0, 0],
            nx: [7, 4, 14, 23, 11],
            ny: [8, 4, 8, 4, 0],
            nz: [1, 1, 0, 0, 1]
          },
          {
            size: 5,
            px: [7, 12, 6, 12, 12],
            py: [12, 8, 3, 10, 9],
            pz: [0, 0, 1, 0, 0],
            nx: [4, 9, 8, 15, 15],
            ny: [4, 8, 4, 8, 8],
            nz: [1, 0, 1, 0, -1]
          },
          {
            size: 3,
            px: [4, 2, 10],
            py: [1, 4, 1],
            pz: [1, 2, 0],
            nx: [2, 3, 8],
            ny: [5, 4, 4],
            nz: [2, 1, -1]
          },
          {
            size: 5,
            px: [3, 17, 6, 6, 16],
            py: [2, 12, 4, 14, 12],
            pz: [2, 0, 1, 0, 0],
            nx: [8, 3, 7, 5, 15],
            ny: [4, 4, 4, 4, 8],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 5,
            px: [5, 6, 7, 4, 8],
            py: [3, 3, 3, 1, 3],
            pz: [0, 0, 0, 1, 0],
            nx: [0, 0, 0, 0, 1],
            ny: [5, 4, 3, 2, 0],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 3,
            px: [18, 9, 0],
            py: [14, 7, 0],
            pz: [0, 1, -1],
            nx: [8, 14, 8],
            ny: [10, 9, 4],
            nz: [1, 0, 1]
          },
          {
            size: 2,
            px: [9, 5],
            py: [18, 13],
            pz: [0, 0],
            nx: [10, 3],
            ny: [16, 4],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [11, 11, 11, 11, 6],
            py: [10, 12, 11, 13, 6],
            pz: [0, 0, 0, 0, -1],
            nx: [5, 21, 22, 22, 22],
            ny: [4, 22, 17, 19, 18],
            nz: [2, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [8, 9, 15, 4],
            py: [7, 7, 23, 4],
            pz: [1, 1, 0, 2],
            nx: [8, 5, 0, 3],
            ny: [4, 18, 4, 9],
            nz: [1, -1, -1, -1]
          },
          {
            size: 5,
            px: [11, 10, 12, 11, 11],
            py: [4, 4, 4, 5, 5],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 6, 8, 2, 8],
            ny: [4, 9, 9, 2, 4],
            nz: [1, 1, 0, 2, 1]
          },
          {
            size: 5,
            px: [2, 2, 3, 3, 4],
            py: [10, 9, 14, 13, 15],
            pz: [1, 1, 0, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [5, 9, 10, 19, 18],
            nz: [2, 1, 1, 0, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [13, 12],
            pz: [0, 0],
            nx: [9, 2],
            ny: [15, 2],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [2, 4, 3, 3, 4],
            py: [5, 11, 6, 9, 12],
            pz: [1, 0, 1, 0, 0],
            nx: [6, 2, 11, 11, 0],
            ny: [9, 1, 5, 20, 18],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [18, 9, 17, 19, 16],
            py: [2, 0, 2, 2, 1],
            pz: [0, 1, 0, 0, 0],
            nx: [22, 23, 11, 23, 23],
            ny: [0, 2, 0, 1, 1],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 5,
            px: [5, 5, 6, 7, 6],
            py: [17, 16, 15, 23, 22],
            pz: [0, 0, 0, 0, 0],
            nx: [7, 6, 2, 5, 23],
            ny: [8, 1, 2, 3, 1],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [12, 12, 11, 10, 6],
            py: [14, 13, 18, 4, 22],
            pz: [0, -1, -1, -1, -1],
            nx: [3, 2, 4, 1, 2],
            ny: [19, 4, 23, 13, 16],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [11, 16, 11, 17],
            py: [7, 11, 8, 12],
            pz: [0, 0, 0, 0],
            nx: [7, 14, 10, 4],
            ny: [4, 7, 10, 4],
            nz: [1, 0, -1, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [8, 7],
            pz: [1, 1],
            nx: [4, 2],
            ny: [10, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 9],
            py: [0, 1],
            pz: [1, 0],
            nx: [4, 5],
            ny: [1, 0],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [14, 16],
            py: [3, 3],
            pz: [0, 0],
            nx: [9, 14],
            ny: [4, 21],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [9, 1],
            py: [7, 1],
            pz: [1, -1],
            nx: [8, 9],
            ny: [7, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [1, 0],
            py: [8, 3],
            pz: [0, 2],
            nx: [20, 0],
            ny: [3, 3],
            nz: [0, -1]
          }
        ],
        alpha: [
          -1.581077,
          1.581077,
          -1.389689,
          1.389689,
          -8.733094e-1,
          8.733094e-1,
          -8.525177e-1,
          8.525177e-1,
          -7.416304e-1,
          7.416304e-1,
          -6.609002e-1,
          6.609002e-1,
          -7.119043e-1,
          7.119043e-1,
          -6.204438e-1,
          6.204438e-1,
          -6.638519e-1,
          6.638519e-1,
          -5.518876e-1,
          5.518876e-1,
          -4.898991e-1,
          4.898991e-1,
          -5.508243e-1,
          5.508243e-1,
          -4.635525e-1,
          4.635525e-1,
          -5.163159e-1,
          5.163159e-1,
          -4.495338e-1,
          4.495338e-1,
          -4.515036e-1,
          4.515036e-1,
          -5.130473e-1,
          5.130473e-1,
          -4.694233e-1,
          4.694233e-1,
          -4.022514e-1,
          4.022514e-1,
          -4.05569e-1,
          4.05569e-1,
          -4.151817e-1,
          4.151817e-1,
          -3.352302e-1,
          3.352302e-1
        ]
      },
      {
        count: 32,
        threshold: -5.363782,
        feature: [
          {
            size: 5,
            px: [12, 9, 6, 8, 14],
            py: [4, 2, 13, 3, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [0, 15, 0, 9, 5],
            ny: [2, 7, 3, 8, 8],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [13, 16, 3, 6, 11],
            py: [3, 13, 1, 4, 3],
            pz: [0, 0, 2, 1, 0],
            nx: [7, 4, 8, 14, 14],
            ny: [4, 4, 4, 8, 8],
            nz: [1, 1, 1, 0, -1]
          },
          {
            size: 5,
            px: [10, 19, 18, 19, 19],
            py: [6, 13, 13, 12, 12],
            pz: [1, 0, 0, 0, -1],
            nx: [23, 5, 23, 23, 11],
            ny: [12, 2, 13, 14, 8],
            nz: [0, 2, 0, 0, 1]
          },
          {
            size: 5,
            px: [12, 12, 12, 12, 6],
            py: [11, 13, 12, 10, 6],
            pz: [0, 0, 0, 0, 1],
            nx: [6, 8, 3, 9, 9],
            ny: [8, 4, 4, 4, 4],
            nz: [1, 1, 1, 1, -1]
          },
          {
            size: 5,
            px: [5, 3, 5, 8, 11],
            py: [12, 8, 3, 11, 8],
            pz: [0, 1, 1, 0, 0],
            nx: [4, 0, 1, 1, 9],
            ny: [4, 3, 4, 3, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [13, 3, 12, 14, 12],
            py: [1, 0, 1, 2, 3],
            pz: [0, 2, 0, 0, 0],
            nx: [7, 9, 8, 4, 4],
            ny: [5, 4, 10, 2, 2],
            nz: [1, 1, 1, 2, -1]
          },
          {
            size: 5,
            px: [18, 16, 12, 15, 8],
            py: [12, 23, 7, 11, 8],
            pz: [0, 0, 0, 0, 1],
            nx: [8, 6, 10, 12, 4],
            ny: [4, 4, 10, 6, 3],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [4, 4, 5, 2, 2],
            py: [13, 14, 14, 7, 7],
            pz: [0, 0, 0, 1, -1],
            nx: [0, 0, 0, 0, 1],
            ny: [15, 4, 14, 13, 17],
            nz: [0, 2, 0, 0, 0]
          },
          {
            size: 2,
            px: [9, 9],
            py: [7, 7],
            pz: [1, -1],
            nx: [4, 7],
            ny: [5, 8],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [3, 4, 6, 5, 4],
            py: [2, 2, 14, 6, 9],
            pz: [1, 1, 0, 1, 1],
            nx: [23, 23, 23, 23, 11],
            ny: [0, 3, 2, 1, 0],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 3,
            px: [10, 2, 3],
            py: [23, 4, 7],
            pz: [0, 2, 1],
            nx: [10, 21, 23],
            ny: [21, 9, 2],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [20, 21, 21, 10, 12],
            py: [13, 12, 8, 8, 12],
            pz: [0, 0, 0, 1, 0],
            nx: [8, 16, 3, 3, 11],
            ny: [4, 8, 4, 3, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [2, 21],
            py: [4, 12],
            pz: [2, -1],
            nx: [2, 3],
            ny: [5, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [8, 5, 6, 8, 7],
            py: [0, 2, 1, 1, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [3, 2, 2, 2, 2],
            ny: [0, 0, 1, 2, 2],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [11, 2, 2, 11, 10],
            py: [10, 12, 8, 11, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [3, 5, 2, 4, 2],
            ny: [4, 1, 4, 2, 2],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 4,
            px: [15, 16, 8, 17],
            py: [2, 1, 0, 2],
            pz: [0, 0, 1, 0],
            nx: [19, 20, 0, 8],
            ny: [1, 2, 11, 10],
            nz: [0, 0, -1, -1]
          },
          {
            size: 2,
            px: [17, 16],
            py: [12, 12],
            pz: [0, 0],
            nx: [8, 9],
            ny: [5, 1],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [11, 11, 0, 0],
            py: [12, 13, 0, 0],
            pz: [0, 0, -1, -1],
            nx: [10, 10, 9, 10],
            ny: [10, 12, 13, 11],
            nz: [0, 0, 0, 0]
          },
          {
            size: 3,
            px: [11, 10, 8],
            py: [5, 2, 6],
            pz: [0, -1, -1],
            nx: [8, 12, 4],
            ny: [4, 17, 4],
            nz: [1, 0, 1]
          },
          {
            size: 5,
            px: [10, 21, 10, 20, 20],
            py: [11, 13, 7, 13, 14],
            pz: [1, 0, 1, 0, 0],
            nx: [23, 23, 11, 23, 17],
            ny: [23, 22, 11, 21, 21],
            nz: [0, 0, 1, -1, -1]
          },
          {
            size: 2,
            px: [4, 7],
            py: [3, 9],
            pz: [2, 1],
            nx: [9, 23],
            ny: [4, 22],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [3, 2, 2, 5],
            py: [11, 5, 4, 20],
            pz: [1, 2, 2, 0],
            nx: [4, 23, 11, 23],
            ny: [10, 22, 11, 21],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [7, 5],
            py: [13, 4],
            pz: [0, -1],
            nx: [4, 4],
            ny: [8, 6],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [2, 5],
            py: [4, 9],
            pz: [2, 1],
            nx: [10, 10],
            ny: [16, 16],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [3, 0],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [7, 3, 12, 13, 6],
            py: [11, 5, 23, 23, 7],
            pz: [1, 2, 0, 0, 1],
            nx: [1, 0, 0, 0, 0],
            ny: [23, 20, 19, 21, 21],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [10, 9, 6, 13, 13],
            pz: [0, 0, 1, 0, -1],
            nx: [8, 8, 4, 4, 9],
            ny: [4, 11, 5, 4, 5],
            nz: [1, 1, 2, 2, 1]
          },
          {
            size: 2,
            px: [9, 18],
            py: [8, 15],
            pz: [1, 0],
            nx: [15, 4],
            ny: [15, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 13],
            py: [6, 17],
            pz: [1, -1],
            nx: [1, 2],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [19, 10, 20, 18, 18],
            py: [2, 0, 2, 2, 2],
            pz: [0, 1, 0, 0, -1],
            nx: [22, 23, 22, 11, 23],
            ny: [1, 3, 0, 1, 2],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 5,
            px: [4, 2, 2, 2, 6],
            py: [7, 2, 5, 4, 14],
            pz: [1, 2, 2, 2, 0],
            nx: [16, 7, 9, 15, 23],
            ny: [8, 0, 3, 11, 2],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [10, 10, 9, 9, 5],
            py: [2, 0, 0, 1, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [3, 2, 3, 2, 2],
            ny: [11, 3, 9, 5, 5],
            nz: [1, 2, 1, 2, -1]
          }
        ],
        alpha: [
          -1.490426,
          1.490426,
          -1.21428,
          1.21428,
          -8.124863e-1,
          8.124863e-1,
          -7.307594e-1,
          7.307594e-1,
          -7.377259e-1,
          7.377259e-1,
          -5.982859e-1,
          5.982859e-1,
          -6.451736e-1,
          6.451736e-1,
          -6.117417e-1,
          6.117417e-1,
          -5.438949e-1,
          5.438949e-1,
          -4.563701e-1,
          4.563701e-1,
          -4.975362e-1,
          4.975362e-1,
          -4.707373e-1,
          4.707373e-1,
          -5.013868e-1,
          5.013868e-1,
          -5.139018e-1,
          5.139018e-1,
          -4.728007e-1,
          4.728007e-1,
          -4.839748e-1,
          4.839748e-1,
          -4.852528e-1,
          4.852528e-1,
          -5.768956e-1,
          5.768956e-1,
          -3.635091e-1,
          3.635091e-1,
          -4.19009e-1,
          4.19009e-1,
          -3.854715e-1,
          3.854715e-1,
          -3.409591e-1,
          3.409591e-1,
          -3.440222e-1,
          3.440222e-1,
          -3.375895e-1,
          3.375895e-1,
          -3.367032e-1,
          3.367032e-1,
          -3.708106e-1,
          3.708106e-1,
          -3.260956e-1,
          3.260956e-1,
          -3.657681e-1,
          3.657681e-1,
          -3.5188e-1,
          3.5188e-1,
          -3.845758e-1,
          3.845758e-1,
          -2.832236e-1,
          2.832236e-1,
          -2.865156e-1,
          2.865156e-1
        ]
      },
      {
        count: 45,
        threshold: -5.479836,
        feature: [
          {
            size: 5,
            px: [15, 6, 17, 6, 9],
            py: [2, 13, 13, 4, 3],
            pz: [0, 0, 0, 1, 0],
            nx: [3, 9, 4, 8, 14],
            ny: [5, 8, 4, 4, 8],
            nz: [2, 0, 1, 1, 0]
          },
          {
            size: 5,
            px: [9, 8, 11, 6, 7],
            py: [1, 2, 3, 14, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [0, 0, 4, 0, 0],
            ny: [4, 2, 4, 1, 0],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 5,
            px: [2, 2, 11, 11, 11],
            py: [2, 4, 10, 8, 6],
            pz: [2, 2, 0, 0, 0],
            nx: [8, 4, 3, 23, 23],
            ny: [4, 4, 4, 16, 18],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 5,
            px: [18, 16, 17, 15, 9],
            py: [2, 2, 2, 2, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [22, 22, 21, 23, 23],
            ny: [1, 2, 0, 5, 4],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [15, 3, 17, 18, 6],
            py: [11, 2, 11, 11, 4],
            pz: [0, 2, 0, 0, 1],
            nx: [3, 8, 1, 4, 23],
            ny: [4, 4, 3, 9, 4],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 5],
            py: [4, 0],
            pz: [2, -1],
            nx: [7, 4],
            ny: [8, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [11, 5],
            py: [12, 5],
            pz: [0, -1],
            nx: [4, 9],
            ny: [10, 15],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [2, 2, 7, 1],
            py: [7, 7, 3, 4],
            pz: [1, -1, -1, -1],
            nx: [0, 2, 1, 2],
            ny: [6, 20, 14, 16],
            nz: [1, 0, 0, 0]
          },
          {
            size: 5,
            px: [14, 12, 12, 13, 9],
            py: [23, 5, 6, 5, 7],
            pz: [0, 0, 0, 0, 1],
            nx: [8, 18, 2, 8, 14],
            ny: [4, 9, 0, 12, 7],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [3, 10, 13, 11, 9],
            py: [0, 3, 2, 3, 2],
            pz: [2, 0, 0, 0, 0],
            nx: [3, 11, 22, 22, 22],
            ny: [2, 6, 15, 2, 0],
            nz: [2, 1, 0, 0, 0]
          },
          {
            size: 5,
            px: [8, 7, 5, 8, 5],
            py: [23, 12, 12, 12, 13],
            pz: [0, 0, 0, 0, 0],
            nx: [3, 18, 3, 1, 22],
            ny: [4, 4, 4, 2, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [22, 22, 22, 21, 22],
            py: [9, 11, 10, 14, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [23, 23, 11, 1, 22],
            ny: [23, 23, 11, 2, 0],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [9, 3],
            py: [18, 7],
            pz: [0, 1],
            nx: [10, 8],
            ny: [16, 19],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [10, 12, 11, 6, 6],
            py: [4, 4, 4, 2, 2],
            pz: [0, 0, 0, 1, -1],
            nx: [3, 8, 7, 8, 4],
            ny: [5, 4, 4, 10, 4],
            nz: [2, 1, 1, 0, 1]
          },
          {
            size: 4,
            px: [12, 12, 4, 15],
            py: [13, 12, 0, 11],
            pz: [0, 0, -1, -1],
            nx: [13, 14, 13, 14],
            ny: [9, 12, 10, 13],
            nz: [0, 0, 0, 0]
          },
          {
            size: 2,
            px: [4, 4],
            py: [3, 3],
            pz: [2, -1],
            nx: [9, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 3,
            px: [9, 7, 0],
            py: [7, 5, 5],
            pz: [1, -1, -1],
            nx: [4, 15, 9],
            ny: [5, 14, 9],
            nz: [2, 0, 1]
          },
          {
            size: 5,
            px: [15, 20, 7, 10, 16],
            py: [17, 12, 6, 4, 23],
            pz: [0, 0, 1, 1, 0],
            nx: [1, 2, 2, 1, 1],
            ny: [3, 0, 1, 2, 2],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [2, 1, 1, 11, 2],
            py: [16, 4, 5, 12, 14],
            pz: [0, 1, 1, 0, 0],
            nx: [4, 6, 3, 19, 1],
            ny: [4, 2, 5, 19, 2],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [15, 14, 14],
            py: [1, 1, 0],
            pz: [0, 0, 0],
            nx: [4, 8, 4],
            ny: [3, 4, 2],
            nz: [2, 1, 2]
          },
          {
            size: 5,
            px: [2, 3, 1, 2, 7],
            py: [8, 12, 4, 9, 13],
            pz: [1, 0, 2, 1, 0],
            nx: [1, 1, 0, 0, 0],
            ny: [21, 20, 18, 17, 9],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [17, 15, 17, 16, 16],
            py: [12, 12, 22, 23, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [7, 3, 16, 1, 0],
            ny: [8, 6, 8, 3, 9],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [9, 17, 18, 18, 18],
            py: [6, 12, 12, 13, 13],
            pz: [1, 0, 0, 0, -1],
            nx: [23, 23, 20, 11, 11],
            ny: [12, 13, 23, 7, 8],
            nz: [0, 0, 0, 1, 1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [4, 7],
            pz: [2, 1],
            nx: [4, 4],
            ny: [10, 5],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [4, 22, 19, 12],
            py: [5, 8, 14, 9],
            pz: [2, 0, 0, 0],
            nx: [8, 4, 4, 2],
            ny: [4, 4, 1, 2],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [3, 21],
            py: [7, 14],
            pz: [1, -1],
            nx: [4, 2],
            ny: [7, 2],
            nz: [1, 2]
          },
          {
            size: 3,
            px: [7, 4, 17],
            py: [3, 1, 6],
            pz: [0, 1, -1],
            nx: [3, 4, 5],
            ny: [0, 2, 1],
            nz: [1, 0, 0]
          },
          {
            size: 4,
            px: [15, 7, 14, 0],
            py: [3, 1, 3, 7],
            pz: [0, 1, 0, -1],
            nx: [8, 18, 17, 18],
            ny: [0, 1, 1, 2],
            nz: [1, 0, 0, 0]
          },
          {
            size: 5,
            px: [12, 12, 12, 12, 6],
            py: [10, 11, 12, 13, 6],
            pz: [0, 0, 0, 0, -1],
            nx: [8, 15, 15, 4, 8],
            ny: [10, 10, 9, 2, 4],
            nz: [0, 0, 0, 2, 1]
          },
          {
            size: 2,
            px: [17, 12],
            py: [13, 11],
            pz: [0, -1],
            nx: [9, 8],
            ny: [4, 10],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [10, 9, 12, 11, 4],
            pz: [0, 0, 0, 0, 1],
            nx: [8, 9, 8, 9, 9],
            ny: [10, 4, 4, 5, 5],
            nz: [1, 1, 1, 1, -1]
          },
          {
            size: 3,
            px: [7, 0, 1],
            py: [1, 9, 8],
            pz: [0, -1, -1],
            nx: [4, 3, 3],
            ny: [7, 15, 16],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [4, 7],
            py: [15, 23],
            pz: [0, 0],
            nx: [9, 18],
            ny: [21, 3],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [17, 4, 19, 18, 8],
            py: [12, 3, 12, 17, 6],
            pz: [0, 2, 0, 0, 1],
            nx: [23, 23, 11, 22, 16],
            ny: [0, 1, 0, 21, -1],
            nz: [0, 0, -1, -1, -1]
          },
          {
            size: 2,
            px: [7, 4],
            py: [13, 5],
            pz: [0, -1],
            nx: [4, 2],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [21, 20, 10, 10, 21],
            py: [13, 14, 10, 7, 11],
            pz: [0, 0, 1, 1, 0],
            nx: [4, 4, 4, 5, 5],
            ny: [18, 17, 19, 20, 20],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [11, 13],
            pz: [1, 0],
            nx: [12, 4],
            ny: [17, 17],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [13, 1],
            pz: [0, -1],
            nx: [1, 2],
            ny: [1, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [15, 7],
            py: [17, 7],
            pz: [0, 1],
            nx: [14, 4],
            ny: [15, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 11],
            py: [3, 8],
            pz: [2, 0],
            nx: [13, 13],
            ny: [9, 8],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 3],
            py: [11, 2],
            pz: [0, -1],
            nx: [8, 4],
            ny: [9, 5],
            nz: [0, 1]
          },
          {
            size: 3,
            px: [12, 6, 9],
            py: [9, 10, 11],
            pz: [0, -1, -1],
            nx: [2, 1, 5],
            ny: [2, 1, 6],
            nz: [2, 2, 1]
          },
          {
            size: 4,
            px: [4, 5, 5, 1],
            py: [11, 11, 11, 3],
            pz: [1, 0, 1, 2],
            nx: [0, 0, 5, 4],
            ny: [23, 22, 0, 0],
            nz: [0, 0, -1, -1]
          },
          {
            size: 5,
            px: [15, 7, 17, 15, 16],
            py: [1, 0, 2, 2, 0],
            pz: [0, 1, 0, 0, 0],
            nx: [7, 4, 7, 4, 8],
            ny: [5, 2, 4, 3, 4],
            nz: [1, 2, 1, 2, -1]
          },
          {
            size: 2,
            px: [6, 12],
            py: [11, 23],
            pz: [1, 0],
            nx: [12, 4],
            ny: [21, 2],
            nz: [0, -1]
          }
        ],
        alpha: [
          -1.5358,
          1.5358,
          -8.580514e-1,
          8.580514e-1,
          -8.62521e-1,
          8.62521e-1,
          -7.1775e-1,
          7.1775e-1,
          -6.832222e-1,
          6.832222e-1,
          -5.736298e-1,
          5.736298e-1,
          -5.028217e-1,
          5.028217e-1,
          -5.091788e-1,
          5.091788e-1,
          -5.79194e-1,
          5.79194e-1,
          -4.924942e-1,
          4.924942e-1,
          -5.489055e-1,
          5.489055e-1,
          -4.52819e-1,
          4.52819e-1,
          -4.748324e-1,
          4.748324e-1,
          -4.150403e-1,
          4.150403e-1,
          -4.820464e-1,
          4.820464e-1,
          -4.840212e-1,
          4.840212e-1,
          -3.941872e-1,
          3.941872e-1,
          -3.663507e-1,
          3.663507e-1,
          -3.814835e-1,
          3.814835e-1,
          -3.936426e-1,
          3.936426e-1,
          -3.04997e-1,
          3.04997e-1,
          -3.604256e-1,
          3.604256e-1,
          -3.974041e-1,
          3.974041e-1,
          -4.203486e-1,
          4.203486e-1,
          -3.174435e-1,
          3.174435e-1,
          -3.426336e-1,
          3.426336e-1,
          -4.49215e-1,
          4.49215e-1,
          -3.538784e-1,
          3.538784e-1,
          -3.679703e-1,
          3.679703e-1,
          -3.985452e-1,
          3.985452e-1,
          -2.884028e-1,
          2.884028e-1,
          -2.797264e-1,
          2.797264e-1,
          -2.664214e-1,
          2.664214e-1,
          -2.484857e-1,
          2.484857e-1,
          -2.581492e-1,
          2.581492e-1,
          -2.943778e-1,
          2.943778e-1,
          -2.315507e-1,
          2.315507e-1,
          -2.979337e-1,
          2.979337e-1,
          -2.976173e-1,
          2.976173e-1,
          -2.847965e-1,
          2.847965e-1,
          -2.814763e-1,
          2.814763e-1,
          -2.489068e-1,
          2.489068e-1,
          -2.632427e-1,
          2.632427e-1,
          -3.308292e-1,
          3.308292e-1,
          -2.79017e-1,
          2.79017e-1
        ]
      },
      {
        count: 61,
        threshold: -5.239104,
        feature: [
          {
            size: 5,
            px: [8, 8, 11, 15, 6],
            py: [3, 6, 5, 3, 4],
            pz: [0, 1, 0, 0, 1],
            nx: [3, 9, 14, 8, 4],
            ny: [4, 8, 8, 7, 2],
            nz: [1, 0, 0, 0, 2]
          },
          {
            size: 5,
            px: [11, 12, 10, 6, 9],
            py: [3, 3, 2, 13, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [0, 0, 5, 2, 2],
            ny: [13, 1, 8, 5, 2],
            nz: [0, 1, 1, 2, 2]
          },
          {
            size: 5,
            px: [11, 5, 11, 11, 4],
            py: [9, 13, 10, 11, 6],
            pz: [0, 0, 0, 0, 1],
            nx: [4, 15, 9, 3, 3],
            ny: [5, 8, 9, 4, 4],
            nz: [1, 0, 0, 1, -1]
          },
          {
            size: 5,
            px: [15, 16, 8, 17, 17],
            py: [1, 2, 0, 2, 2],
            pz: [0, 0, 1, 0, -1],
            nx: [23, 23, 23, 23, 23],
            ny: [4, 0, 2, 3, 1],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [9, 18, 17, 18],
            py: [7, 13, 13, 14],
            pz: [1, 0, 0, 0],
            nx: [9, 7, 4, 8],
            ny: [4, 10, 2, 4],
            nz: [1, 1, 2, 1]
          },
          {
            size: 5,
            px: [12, 11, 12, 12, 6],
            py: [6, 5, 14, 5, 3],
            pz: [0, 0, 0, 0, 1],
            nx: [13, 8, 14, 7, 7],
            ny: [16, 4, 7, 4, 4],
            nz: [0, 1, 0, 1, -1]
          },
          {
            size: 5,
            px: [12, 6, 3, 7, 12],
            py: [7, 12, 7, 11, 8],
            pz: [0, 0, 1, 0, 0],
            nx: [16, 4, 4, 4, 7],
            ny: [8, 4, 4, 4, 4],
            nz: [0, 1, -1, -1, -1]
          },
          {
            size: 5,
            px: [6, 4, 5, 3, 3],
            py: [2, 3, 2, 0, 0],
            pz: [0, 0, 0, 1, -1],
            nx: [1, 0, 1, 0, 0],
            ny: [0, 3, 1, 1, 2],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [15, 9],
            py: [11, 6],
            pz: [0, 1],
            nx: [14, 5],
            ny: [9, 11],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [10, 19, 19, 10, 20],
            py: [7, 20, 14, 6, 12],
            pz: [1, 0, 0, 1, 0],
            nx: [23, 22, 11, 23, 23],
            ny: [21, 23, 9, 20, 20],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 5,
            px: [1, 1, 5, 1, 1],
            py: [8, 6, 6, 9, 4],
            pz: [0, 1, 1, 0, 2],
            nx: [3, 3, 3, 2, 5],
            ny: [4, 4, 2, 5, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [13, 12, 3, 11, 11],
            py: [2, 2, 0, 1, 2],
            pz: [0, 0, 2, 0, 0],
            nx: [3, 6, 8, 4, 3],
            ny: [2, 9, 4, 4, 5],
            nz: [2, 1, 1, 1, -1]
          },
          {
            size: 3,
            px: [12, 12, 6],
            py: [11, 12, 9],
            pz: [0, 0, -1],
            nx: [2, 1, 9],
            ny: [6, 1, 14],
            nz: [0, 2, 0]
          },
          {
            size: 5,
            px: [6, 3, 17, 16, 16],
            py: [4, 2, 14, 23, 13],
            pz: [1, 2, 0, 0, 0],
            nx: [8, 10, 21, 5, 1],
            ny: [4, 10, 11, 0, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [5, 6, 1, 3, 3],
            py: [15, 14, 4, 7, 7],
            pz: [0, 0, 2, 1, -1],
            nx: [1, 0, 0, 1, 1],
            ny: [5, 8, 7, 18, 17],
            nz: [2, 1, 1, 0, 0]
          },
          {
            size: 4,
            px: [6, 12, 5, 3],
            py: [6, 12, 2, 7],
            pz: [1, -1, -1, -1],
            nx: [14, 13, 13, 7],
            ny: [12, 10, 9, 8],
            nz: [0, 0, 0, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 15],
            pz: [1, 0],
            nx: [3, 3],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [11, 10, 12, 2],
            py: [18, 18, 18, 3],
            pz: [0, 0, 0, 2],
            nx: [11, 17, 4, 16],
            ny: [16, 4, 4, 21],
            nz: [0, -1, -1, -1]
          },
          {
            size: 5,
            px: [9, 8, 8, 5, 2],
            py: [4, 4, 4, 2, 3],
            pz: [0, 0, -1, -1, -1],
            nx: [2, 2, 4, 4, 2],
            ny: [1, 2, 10, 5, 4],
            nz: [2, 2, 1, 1, 2]
          },
          {
            size: 4,
            px: [8, 18, 14, 18],
            py: [7, 16, 23, 15],
            pz: [1, 0, 0, 0],
            nx: [14, 3, 1, 0],
            ny: [21, 1, 9, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [12, 3],
            py: [9, 5],
            pz: [0, 2],
            nx: [8, 1],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [1, 1],
            pz: [1, -1],
            nx: [19, 20],
            ny: [1, 2],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [10, 10, 10],
            py: [6, 6, 8],
            pz: [1, -1, -1],
            nx: [22, 21, 22],
            ny: [13, 18, 12],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [2, 2],
            py: [4, 1],
            pz: [2, -1],
            nx: [2, 4],
            ny: [5, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [21, 21, 21, 21, 21],
            py: [19, 17, 18, 15, 16],
            pz: [0, 0, 0, 0, 0],
            nx: [11, 21, 6, 1, 21],
            ny: [17, 1, 10, 0, 2],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [7, 3, 4, 4, 4],
            py: [23, 13, 14, 16, 13],
            pz: [0, 0, 0, 0, 0],
            nx: [21, 22, 22, 22, 22],
            ny: [23, 21, 20, 19, 19],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [11, 8],
            py: [6, 6],
            pz: [0, 1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [23, 23, 11, 23, 23],
            py: [8, 12, 6, 11, 10],
            pz: [0, 0, 1, 0, 0],
            nx: [4, 4, 3, 8, 8],
            ny: [3, 8, 4, 4, 4],
            nz: [1, 1, 1, 1, -1]
          },
          {
            size: 5,
            px: [8, 9, 4, 7, 10],
            py: [2, 1, 0, 2, 1],
            pz: [0, 0, 1, 0, 0],
            nx: [5, 5, 6, 4, 4],
            ny: [1, 0, 0, 2, 1],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [12, 2],
            py: [13, 6],
            pz: [0, -1],
            nx: [15, 9],
            ny: [15, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [4, 9],
            pz: [2, 1],
            nx: [3, 13],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [3, 6, 2],
            py: [10, 22, 4],
            pz: [1, 0, 2],
            nx: [4, 2, 1],
            ny: [10, 4, 3],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [1, 0],
            py: [9, 7],
            pz: [0, 1],
            nx: [0, 0],
            ny: [23, 22],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 7],
            py: [0, 1],
            pz: [0, 0],
            nx: [4, 4],
            ny: [8, 8],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [7, 4, 4, 6, 3],
            py: [8, 4, 5, 5, 3],
            pz: [1, 2, 2, 1, 2],
            nx: [1, 0, 2, 0, 0],
            ny: [1, 0, 0, 2, 4],
            nz: [0, 2, 0, 1, -1]
          },
          {
            size: 3,
            px: [10, 4, 4],
            py: [6, 1, 5],
            pz: [1, -1, -1],
            nx: [5, 23, 22],
            ny: [4, 13, 7],
            nz: [2, 0, 0]
          },
          {
            size: 2,
            px: [2, 2],
            py: [6, 5],
            pz: [1, 1],
            nx: [6, 0],
            ny: [9, 2],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [0, 1, 1, 0, 0],
            py: [5, 18, 19, 16, 6],
            pz: [2, 0, 0, 0, 1],
            nx: [5, 9, 4, 8, 8],
            ny: [8, 7, 3, 7, 7],
            nz: [1, 0, 1, 0, -1]
          },
          {
            size: 2,
            px: [13, 12],
            py: [23, 23],
            pz: [0, 0],
            nx: [7, 6],
            ny: [8, 10],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [14, 19],
            py: [12, 8],
            pz: [0, 0],
            nx: [18, 5],
            ny: [8, 11],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [2, 8, 6, 4, 4],
            py: [3, 23, 14, 6, 9],
            pz: [2, 0, 0, 1, 1],
            nx: [0, 0, 0, 0, 1],
            ny: [21, 20, 5, 19, 23],
            nz: [0, 0, 2, 0, 0]
          },
          {
            size: 2,
            px: [11, 22],
            py: [4, 14],
            pz: [0, -1],
            nx: [3, 8],
            ny: [1, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [1, 1, 0, 1, 1],
            py: [6, 8, 3, 12, 7],
            pz: [1, 1, 2, 0, 1],
            nx: [21, 21, 19, 10, 10],
            ny: [14, 16, 23, 9, 9],
            nz: [0, 0, 0, 1, -1]
          },
          {
            size: 2,
            px: [10, 3],
            py: [23, 2],
            pz: [0, 2],
            nx: [10, 3],
            ny: [21, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [7, 0],
            pz: [1, -1],
            nx: [9, 9],
            ny: [11, 10],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [23, 11, 23, 23, 23],
            py: [18, 10, 19, 20, 16],
            pz: [0, 1, 0, 0, 0],
            nx: [3, 3, 2, 3, 2],
            ny: [15, 16, 10, 17, 9],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 2,
            px: [9, 14],
            py: [7, 18],
            pz: [1, 0],
            nx: [7, 10],
            ny: [8, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [6, 4],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [4, 5],
            py: [13, 4],
            pz: [0, -1],
            nx: [4, 4],
            ny: [17, 19],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [2, 3, 3],
            py: [11, 17, 19],
            pz: [1, 0, 0],
            nx: [7, 7, 4],
            ny: [8, 8, 5],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [6, 6],
            py: [6, 5],
            pz: [1, -1],
            nx: [2, 9],
            ny: [4, 12],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [8, 8, 9, 2, 2],
            py: [18, 13, 12, 3, 3],
            pz: [0, 0, 0, 2, -1],
            nx: [23, 11, 23, 11, 11],
            ny: [13, 6, 14, 7, 8],
            nz: [0, 1, 0, 1, 1]
          },
          {
            size: 2,
            px: [9, 11],
            py: [6, 13],
            pz: [1, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [8, 10],
            py: [0, 6],
            pz: [1, 1],
            nx: [9, 4],
            ny: [6, 7],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [3, 10, 9],
            py: [8, 6, 0],
            pz: [1, -1, -1],
            nx: [2, 2, 2],
            ny: [15, 16, 9],
            nz: [0, 0, 1]
          },
          {
            size: 3,
            px: [14, 15, 0],
            py: [2, 2, 5],
            pz: [0, 0, -1],
            nx: [17, 17, 18],
            ny: [0, 1, 2],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [11, 5],
            py: [14, 1],
            pz: [0, -1],
            nx: [10, 9],
            ny: [12, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 8],
            py: [7, 8],
            pz: [1, 1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [19, 18, 10, 5, 20],
            pz: [0, 0, 1, 2, 0],
            nx: [4, 8, 2, 4, 4],
            ny: [4, 15, 5, 10, 10],
            nz: [1, 0, 2, 1, -1]
          },
          {
            size: 2,
            px: [7, 0],
            py: [13, 18],
            pz: [0, -1],
            nx: [4, 3],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [23, 22, 22, 11, 22],
            py: [16, 13, 7, 6, 14],
            pz: [0, 0, 0, 1, 0],
            nx: [13, 7, 15, 14, 14],
            ny: [6, 3, 7, 6, 6],
            nz: [0, 1, 0, 0, -1]
          }
        ],
        alpha: [
          -1.428861,
          1.428861,
          -8.591837e-1,
          8.591837e-1,
          -7.734305e-1,
          7.734305e-1,
          -6.53446e-1,
          6.53446e-1,
          -6.262547e-1,
          6.262547e-1,
          -5.231782e-1,
          5.231782e-1,
          -4.984303e-1,
          4.984303e-1,
          -4.913187e-1,
          4.913187e-1,
          -4.852198e-1,
          4.852198e-1,
          -4.906681e-1,
          4.906681e-1,
          -4.126248e-1,
          4.126248e-1,
          -4.590814e-1,
          4.590814e-1,
          -4.653825e-1,
          4.653825e-1,
          -4.1796e-1,
          4.1796e-1,
          -4.357392e-1,
          4.357392e-1,
          -4.087982e-1,
          4.087982e-1,
          -4.594812e-1,
          4.594812e-1,
          -4.858794e-1,
          4.858794e-1,
          -3.71358e-1,
          3.71358e-1,
          -3.894534e-1,
          3.894534e-1,
          -3.127168e-1,
          3.127168e-1,
          -4.012654e-1,
          4.012654e-1,
          -3.370552e-1,
          3.370552e-1,
          -3.534712e-1,
          3.534712e-1,
          -3.84345e-1,
          3.84345e-1,
          -2.688805e-1,
          2.688805e-1,
          -3.500203e-1,
          3.500203e-1,
          -2.82712e-1,
          2.82712e-1,
          -3.742119e-1,
          3.742119e-1,
          -3.219074e-1,
          3.219074e-1,
          -2.544953e-1,
          2.544953e-1,
          -3.355513e-1,
          3.355513e-1,
          -2.67267e-1,
          2.67267e-1,
          -2.932047e-1,
          2.932047e-1,
          -2.404618e-1,
          2.404618e-1,
          -2.354372e-1,
          2.354372e-1,
          -2.657955e-1,
          2.657955e-1,
          -2.293701e-1,
          2.293701e-1,
          -2.708918e-1,
          2.708918e-1,
          -2.340181e-1,
          2.340181e-1,
          -2.464815e-1,
          2.464815e-1,
          -2.944239e-1,
          2.944239e-1,
          -2.40796e-1,
          2.40796e-1,
          -3.029642e-1,
          3.029642e-1,
          -2.684602e-1,
          2.684602e-1,
          -2.495078e-1,
          2.495078e-1,
          -2.539708e-1,
          2.539708e-1,
          -2.989293e-1,
          2.989293e-1,
          -2.391309e-1,
          2.391309e-1,
          -2.531372e-1,
          2.531372e-1,
          -2.50039e-1,
          2.50039e-1,
          -2.295077e-1,
          2.295077e-1,
          -2.526125e-1,
          2.526125e-1,
          -2.337182e-1,
          2.337182e-1,
          -1.984756e-1,
          1.984756e-1,
          -3.089996e-1,
          3.089996e-1,
          -2.589053e-1,
          2.589053e-1,
          -2.96249e-1,
          2.96249e-1,
          -2.45866e-1,
          2.45866e-1,
          -2.515206e-1,
          2.515206e-1,
          -2.637299e-1,
          2.637299e-1
        ]
      },
      {
        count: 80,
        threshold: -5.185898,
        feature: [
          {
            size: 5,
            px: [12, 17, 13, 10, 15],
            py: [9, 13, 3, 3, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 14, 6, 9, 4],
            ny: [10, 9, 8, 8, 2],
            nz: [1, 0, 1, 0, 2]
          },
          {
            size: 5,
            px: [3, 11, 8, 10, 9],
            py: [7, 4, 3, 3, 3],
            pz: [1, 0, 0, 0, 0],
            nx: [2, 1, 5, 0, 0],
            ny: [2, 15, 8, 4, 13],
            nz: [2, 0, 1, 0, 0]
          },
          {
            size: 5,
            px: [11, 11, 11, 4, 17],
            py: [7, 9, 8, 6, 11],
            pz: [0, 0, 0, 1, 0],
            nx: [8, 8, 8, 3, 0],
            ny: [4, 8, 8, 8, 13],
            nz: [1, 0, -1, -1, -1]
          },
          {
            size: 5,
            px: [14, 15, 7, 16, 16],
            py: [3, 3, 1, 3, 3],
            pz: [0, 0, 1, 0, -1],
            nx: [23, 22, 23, 22, 22],
            ny: [6, 2, 14, 3, 4],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [6, 4, 7, 15],
            py: [4, 2, 6, 17],
            pz: [1, 2, 1, 0],
            nx: [3, 8, 3, 14],
            ny: [4, 4, 10, 22],
            nz: [1, 1, -1, -1]
          },
          {
            size: 3,
            px: [3, 5, 22],
            py: [7, 7, 5],
            pz: [1, -1, -1],
            nx: [2, 2, 4],
            ny: [5, 2, 7],
            nz: [2, 2, 1]
          },
          {
            size: 5,
            px: [7, 6, 5, 6, 3],
            py: [0, 1, 2, 2, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [0, 1, 1, 0, 1],
            ny: [0, 2, 1, 2, 0],
            nz: [2, 0, 0, 1, 0]
          },
          {
            size: 5,
            px: [11, 11, 11, 11, 5],
            py: [11, 10, 13, 12, 6],
            pz: [0, 0, 0, 0, -1],
            nx: [15, 14, 5, 2, 8],
            ny: [9, 8, 10, 2, 10],
            nz: [0, 0, 1, 2, 0]
          },
          {
            size: 5,
            px: [8, 5, 6, 8, 7],
            py: [12, 12, 12, 23, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [3, 17, 5, 2, 8],
            ny: [4, 0, 10, 2, 10],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [10, 10, 10, 19, 20],
            py: [8, 10, 9, 15, 13],
            pz: [1, 1, 1, 0, 0],
            nx: [23, 11, 5, 23, 23],
            ny: [20, 10, 5, 19, 19],
            nz: [0, 1, 2, 0, -1]
          },
          {
            size: 5,
            px: [9, 13, 3, 10, 12],
            py: [2, 0, 0, 1, 1],
            pz: [0, 0, 2, 0, 0],
            nx: [3, 3, 6, 7, 7],
            ny: [5, 2, 11, 4, 4],
            nz: [2, 2, 1, 1, -1]
          },
          {
            size: 2,
            px: [15, 7],
            py: [17, 6],
            pz: [0, 1],
            nx: [14, 0],
            ny: [16, 10],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [17, 15, 18, 12, 19],
            py: [22, 12, 13, 7, 15],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 15, 6, 1, 7],
            ny: [4, 8, 22, 5, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [10, 9, 18, 19, 8],
            py: [2, 1, 3, 3, 1],
            pz: [1, 1, 0, 0, 1],
            nx: [23, 23, 23, 11, 11],
            ny: [0, 1, 2, 0, 1],
            nz: [0, 0, 0, 1, -1]
          },
          {
            size: 5,
            px: [12, 23, 0, 1, 8],
            py: [14, 5, 0, 17, 1],
            pz: [0, -1, -1, -1, -1],
            nx: [8, 14, 15, 18, 14],
            ny: [10, 11, 14, 19, 10],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [4, 6],
            py: [6, 13],
            pz: [1, 0],
            nx: [4, 12],
            ny: [10, 14],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [5, 23, 11, 23, 13],
            py: [3, 10, 4, 11, 12],
            pz: [2, 0, 1, 0, 0],
            nx: [7, 4, 9, 8, 8],
            ny: [4, 2, 4, 4, 4],
            nz: [1, 2, 1, 1, -1]
          },
          {
            size: 3,
            px: [9, 5, 11],
            py: [4, 2, 4],
            pz: [0, 1, -1],
            nx: [5, 2, 4],
            ny: [0, 1, 2],
            nz: [0, 2, 0]
          },
          {
            size: 5,
            px: [5, 2, 2, 5, 8],
            py: [12, 4, 4, 6, 13],
            pz: [0, 2, 1, 1, 0],
            nx: [3, 9, 4, 4, 8],
            ny: [4, 0, 2, 2, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [9, 5, 22],
            py: [7, 4, 20],
            pz: [1, -1, -1],
            nx: [8, 19, 4],
            ny: [4, 18, 5],
            nz: [1, 0, 2]
          },
          {
            size: 5,
            px: [2, 3, 3, 3, 3],
            py: [10, 16, 15, 14, 13],
            pz: [1, 0, 0, 0, 0],
            nx: [0, 0, 0, 1, 0],
            ny: [10, 20, 5, 23, 21],
            nz: [1, 0, 2, 0, 0]
          },
          {
            size: 2,
            px: [12, 11],
            py: [4, 18],
            pz: [0, 0],
            nx: [11, 23],
            ny: [17, 13],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [17, 8],
            py: [16, 7],
            pz: [0, 1],
            nx: [8, 3],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [13, 5, 14, 12, 3],
            py: [4, 7, 4, 5, 3],
            pz: [0, 1, 0, 0, 1],
            nx: [21, 20, 21, 21, 21],
            ny: [2, 0, 4, 3, 3],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 4,
            px: [20, 20, 20, 10],
            py: [21, 19, 20, 8],
            pz: [0, 0, 0, 1],
            nx: [8, 11, 0, 2],
            ny: [10, 8, 1, 3],
            nz: [1, -1, -1, -1]
          },
          {
            size: 4,
            px: [6, 7, 12, 8],
            py: [12, 12, 8, 11],
            pz: [0, 0, 0, 0],
            nx: [9, 5, 5, 18],
            ny: [9, 2, 0, 20],
            nz: [0, -1, -1, -1]
          },
          {
            size: 3,
            px: [11, 5, 9],
            py: [0, 0, 0],
            pz: [0, 1, 0],
            nx: [2, 6, 3],
            ny: [3, 7, 4],
            nz: [2, 0, 1]
          },
          {
            size: 5,
            px: [18, 18, 9, 17, 17],
            py: [15, 14, 7, 14, 14],
            pz: [0, 0, 1, 0, -1],
            nx: [21, 21, 21, 22, 20],
            ny: [15, 21, 17, 14, 23],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [9, 12, 12, 7, 4],
            py: [4, 11, 12, 6, 5],
            pz: [1, 0, 0, 1, 2],
            nx: [16, 11, 9, 6, 20],
            ny: [8, 4, 11, 10, 23],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [12, 11, 10, 11, 11],
            py: [23, 4, 4, 5, 23],
            pz: [0, 0, 0, 0, 0],
            nx: [11, 11, 7, 3, 20],
            ny: [21, 21, 11, 1, 23],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [12, 1],
            py: [12, 3],
            pz: [0, -1],
            nx: [10, 10],
            ny: [3, 2],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [9, 4, 15, 9, 9],
            py: [8, 4, 23, 7, 7],
            pz: [1, 2, 0, 1, -1],
            nx: [5, 3, 3, 3, 2],
            ny: [23, 19, 17, 18, 15],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [2, 0],
            py: [16, 3],
            pz: [0, 2],
            nx: [9, 4],
            ny: [15, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [3, 7],
            pz: [2, 1],
            nx: [3, 8],
            ny: [4, 10],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [9, 4, 3],
            py: [18, 0, 14],
            pz: [0, -1, -1],
            nx: [3, 5, 2],
            ny: [5, 8, 5],
            nz: [2, 1, 2]
          },
          {
            size: 3,
            px: [1, 1, 10],
            py: [2, 1, 7],
            pz: [1, -1, -1],
            nx: [0, 0, 0],
            ny: [3, 5, 1],
            nz: [0, 0, 1]
          },
          {
            size: 4,
            px: [11, 11, 5, 2],
            py: [12, 13, 7, 3],
            pz: [0, 0, -1, -1],
            nx: [5, 10, 10, 9],
            ny: [6, 9, 10, 13],
            nz: [1, 0, 0, 0]
          },
          {
            size: 2,
            px: [4, 8],
            py: [3, 6],
            pz: [2, 1],
            nx: [9, 1],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [0, 0, 1, 1, 0],
            py: [4, 10, 12, 13, 5],
            pz: [1, 0, 0, 0, 1],
            nx: [4, 4, 8, 7, 7],
            ny: [3, 2, 10, 4, 4],
            nz: [2, 2, 1, 1, -1]
          },
          {
            size: 3,
            px: [3, 4, 3],
            py: [1, 1, 2],
            pz: [1, -1, -1],
            nx: [4, 5, 3],
            ny: [1, 0, 2],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [9, 2],
            py: [6, 4],
            pz: [1, -1],
            nx: [8, 4],
            ny: [6, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [12, 13, 15, 16, 7],
            py: [1, 1, 2, 2, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [4, 4, 4, 3, 7],
            ny: [2, 2, 4, 2, 4],
            nz: [2, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [9, 3, 2, 11, 5],
            py: [23, 7, 4, 10, 6],
            pz: [0, 1, 2, 0, 1],
            nx: [21, 20, 11, 21, 21],
            ny: [21, 23, 8, 20, 20],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 4,
            px: [12, 6, 13, 12],
            py: [7, 3, 5, 6],
            pz: [0, 1, 0, 0],
            nx: [3, 0, 5, 10],
            ny: [4, 6, 5, 1],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [4, 0],
            pz: [0, -1],
            nx: [12, 11],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 4,
            px: [2, 3, 22, 5],
            py: [6, 1, 18, 5],
            pz: [1, -1, -1, -1],
            nx: [0, 0, 0, 3],
            ny: [14, 3, 12, 18],
            nz: [0, 2, 0, 0]
          },
          {
            size: 3,
            px: [10, 20, 21],
            py: [10, 18, 15],
            pz: [1, 0, 0],
            nx: [15, 1, 2],
            ny: [7, 0, 8],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [4, 7, 13, 4, 6],
            pz: [1, 1, 0, 2, 1],
            nx: [5, 9, 8, 4, 4],
            ny: [3, 7, 7, 3, 3],
            nz: [1, 0, 0, 1, -1]
          },
          {
            size: 3,
            px: [13, 12, 14],
            py: [2, 2, 2],
            pz: [0, 0, 0],
            nx: [4, 4, 4],
            ny: [2, 2, 5],
            nz: [2, -1, -1]
          },
          {
            size: 5,
            px: [5, 4, 6, 2, 12],
            py: [7, 9, 7, 4, 10],
            pz: [0, 1, 0, 2, 0],
            nx: [6, 1, 2, 5, 2],
            ny: [9, 2, 4, 13, 4],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 1],
            py: [12, 5],
            pz: [0, -1],
            nx: [1, 0],
            ny: [7, 2],
            nz: [0, 2]
          },
          {
            size: 5,
            px: [8, 8, 1, 16, 6],
            py: [6, 6, 4, 8, 11],
            pz: [1, -1, -1, -1, -1],
            nx: [13, 5, 4, 4, 13],
            ny: [12, 1, 2, 5, 11],
            nz: [0, 2, 2, 2, 0]
          },
          {
            size: 2,
            px: [5, 6],
            py: [4, 14],
            pz: [1, 0],
            nx: [9, 5],
            ny: [7, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 6],
            py: [4, 14],
            pz: [2, 0],
            nx: [9, 2],
            ny: [15, 1],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [10, 19, 20, 10, 9],
            py: [1, 2, 3, 0, 0],
            pz: [1, 0, 0, 1, -1],
            nx: [11, 23, 23, 11, 23],
            ny: [0, 3, 1, 1, 2],
            nz: [1, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [2, 9],
            py: [3, 12],
            pz: [2, 0],
            nx: [2, 6],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [4, 10, 11, 9, 9],
            pz: [1, 0, 0, 0, -1],
            nx: [16, 2, 17, 8, 4],
            ny: [10, 2, 9, 4, 4],
            nz: [0, 2, 0, 1, 1]
          },
          {
            size: 2,
            px: [12, 0],
            py: [5, 4],
            pz: [0, -1],
            nx: [7, 8],
            ny: [4, 8],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [21, 21],
            py: [9, 10],
            pz: [0, 0],
            nx: [11, 8],
            ny: [18, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [14, 7],
            py: [23, 9],
            pz: [0, 1],
            nx: [7, 13],
            ny: [10, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [12, 12, 12, 6, 2],
            py: [11, 13, 12, 6, 4],
            pz: [0, 0, 0, -1, -1],
            nx: [0, 0, 0, 0, 0],
            ny: [14, 13, 6, 12, 11],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 2,
            px: [8, 9],
            py: [6, 11],
            pz: [1, -1],
            nx: [15, 15],
            ny: [11, 10],
            nz: [0, 0]
          },
          {
            size: 4,
            px: [4, 6, 7, 2],
            py: [8, 4, 23, 7],
            pz: [1, -1, -1, -1],
            nx: [4, 20, 19, 17],
            ny: [0, 3, 1, 1],
            nz: [2, 0, 0, 0]
          },
          {
            size: 2,
            px: [7, 0],
            py: [6, 0],
            pz: [1, -1],
            nx: [7, 4],
            ny: [8, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [10, 0],
            py: [7, 0],
            pz: [1, -1],
            nx: [15, 15],
            ny: [15, 14],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [6, 2, 5, 2, 4],
            py: [23, 7, 21, 8, 16],
            pz: [0, 1, 0, 1, 0],
            nx: [18, 2, 10, 0, 11],
            ny: [9, 3, 23, 5, 3],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [9, 9, 8, 10, 4],
            py: [0, 2, 2, 1, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [4, 3, 2, 2, 5],
            ny: [7, 3, 4, 2, 17],
            nz: [0, 1, 2, 2, 0]
          },
          {
            size: 2,
            px: [10, 7],
            py: [5, 6],
            pz: [1, -1],
            nx: [11, 11],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [11, 11, 5, 6, 11],
            py: [8, 10, 5, 5, 9],
            pz: [0, 0, 1, 1, 0],
            nx: [13, 16, 11, 14, 4],
            ny: [9, 13, 11, 20, 23],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [7, 14],
            py: [14, 22],
            pz: [0, -1],
            nx: [3, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [4, 11],
            py: [4, 5],
            pz: [2, -1],
            nx: [2, 4],
            ny: [5, 7],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [1, 0],
            py: [0, 0],
            pz: [0, 1],
            nx: [0, 4],
            ny: [0, 2],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [11, 11, 11, 4, 9],
            py: [5, 5, 2, 9, 23],
            pz: [0, -1, -1, -1, -1],
            nx: [11, 12, 10, 9, 5],
            ny: [2, 2, 2, 2, 1],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 3,
            px: [16, 14, 15],
            py: [1, 1, 0],
            pz: [0, 0, 0],
            nx: [4, 7, 4],
            ny: [2, 4, 4],
            nz: [2, 1, -1]
          },
          {
            size: 2,
            px: [5, 0],
            py: [14, 5],
            pz: [0, -1],
            nx: [2, 4],
            ny: [5, 17],
            nz: [2, 0]
          },
          {
            size: 5,
            px: [18, 7, 16, 19, 4],
            py: [13, 6, 23, 13, 3],
            pz: [0, 1, 0, 0, 2],
            nx: [5, 2, 3, 4, 4],
            ny: [1, 1, 4, 1, 3],
            nz: [0, 1, 0, 0, 0]
          },
          {
            size: 2,
            px: [8, 8],
            py: [7, 6],
            pz: [1, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [2, 1],
            py: [10, 4],
            pz: [1, 2],
            nx: [4, 4],
            ny: [3, 3],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [19, 1],
            pz: [0, -1],
            nx: [4, 12],
            ny: [10, 17],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [12, 6, 2, 4, 11],
            py: [14, 4, 2, 1, 5],
            pz: [0, -1, -1, -1, -1],
            nx: [3, 4, 3, 4, 3],
            ny: [13, 17, 14, 16, 15],
            nz: [0, 0, 0, 0, 0]
          }
        ],
        alpha: [
          -1.368326,
          1.368326,
          -7.706897e-1,
          7.706897e-1,
          -8.378147e-1,
          8.378147e-1,
          -6.120624e-1,
          6.120624e-1,
          -5.139189e-1,
          5.139189e-1,
          -4.75913e-1,
          4.75913e-1,
          -5.161374e-1,
          5.161374e-1,
          -5.407743e-1,
          5.407743e-1,
          -4.216105e-1,
          4.216105e-1,
          -4.418693e-1,
          4.418693e-1,
          -4.435335e-1,
          4.435335e-1,
          -4.052076e-1,
          4.052076e-1,
          -4.29305e-1,
          4.29305e-1,
          -3.431154e-1,
          3.431154e-1,
          -4.231203e-1,
          4.231203e-1,
          -3.9171e-1,
          3.9171e-1,
          -3.62345e-1,
          3.62345e-1,
          -3.20267e-1,
          3.20267e-1,
          -3.331602e-1,
          3.331602e-1,
          -3.552034e-1,
          3.552034e-1,
          -3.784556e-1,
          3.784556e-1,
          -3.295428e-1,
          3.295428e-1,
          -3.587038e-1,
          3.587038e-1,
          -2.861332e-1,
          2.861332e-1,
          -3.403258e-1,
          3.403258e-1,
          -3.989002e-1,
          3.989002e-1,
          -2.631159e-1,
          2.631159e-1,
          -3.272156e-1,
          3.272156e-1,
          -2.816567e-1,
          2.816567e-1,
          -3.125926e-1,
          3.125926e-1,
          -3.146982e-1,
          3.146982e-1,
          -2.521825e-1,
          2.521825e-1,
          -2.434554e-1,
          2.434554e-1,
          -3.435378e-1,
          3.435378e-1,
          -3.161172e-1,
          3.161172e-1,
          -2.805027e-1,
          2.805027e-1,
          -3.303579e-1,
          3.303579e-1,
          -2.725089e-1,
          2.725089e-1,
          -2.575051e-1,
          2.575051e-1,
          -3.210646e-1,
          3.210646e-1,
          -2.986997e-1,
          2.986997e-1,
          -2.408925e-1,
          2.408925e-1,
          -2.456291e-1,
          2.456291e-1,
          -2.83655e-1,
          2.83655e-1,
          -2.46986e-1,
          2.46986e-1,
          -2.9159e-1,
          2.9159e-1,
          -2.513559e-1,
          2.513559e-1,
          -2.433728e-1,
          2.433728e-1,
          -2.377905e-1,
          2.377905e-1,
          -2.089327e-1,
          2.089327e-1,
          -1.978434e-1,
          1.978434e-1,
          -3.017699e-1,
          3.017699e-1,
          -2.339661e-1,
          2.339661e-1,
          -1.93256e-1,
          1.93256e-1,
          -2.278285e-1,
          2.278285e-1,
          -2.4382e-1,
          2.4382e-1,
          -2.216769e-1,
          2.216769e-1,
          -1.941995e-1,
          1.941995e-1,
          -2.129081e-1,
          2.129081e-1,
          -2.270319e-1,
          2.270319e-1,
          -2.393942e-1,
          2.393942e-1,
          -2.132518e-1,
          2.132518e-1,
          -1.867741e-1,
          1.867741e-1,
          -2.394237e-1,
          2.394237e-1,
          -2.005917e-1,
          2.005917e-1,
          -2.445217e-1,
          2.445217e-1,
          -2.229078e-1,
          2.229078e-1,
          -2.342967e-1,
          2.342967e-1,
          -2.481784e-1,
          2.481784e-1,
          -2.735603e-1,
          2.735603e-1,
          -2.187604e-1,
          2.187604e-1,
          -1.677239e-1,
          1.677239e-1,
          -2.248867e-1,
          2.248867e-1,
          -2.505358e-1,
          2.505358e-1,
          -1.867706e-1,
          1.867706e-1,
          -1.904305e-1,
          1.904305e-1,
          -1.939881e-1,
          1.939881e-1,
          -2.249474e-1,
          2.249474e-1,
          -1.762483e-1,
          1.762483e-1,
          -2.299974e-1,
          2.299974e-1
        ]
      },
      {
        count: 115,
        threshold: -5.15192,
        feature: [
          {
            size: 5,
            px: [7, 14, 7, 10, 6],
            py: [3, 3, 12, 4, 4],
            pz: [0, 0, 0, 0, 1],
            nx: [14, 3, 14, 9, 3],
            ny: [7, 4, 8, 8, 5],
            nz: [0, 1, 0, 0, 2]
          },
          {
            size: 5,
            px: [13, 18, 16, 17, 15],
            py: [1, 13, 1, 2, 0],
            pz: [0, 0, 0, 0, 0],
            nx: [23, 23, 8, 11, 22],
            ny: [3, 4, 4, 8, 0],
            nz: [0, 0, 1, 1, 0]
          },
          {
            size: 5,
            px: [16, 6, 6, 7, 12],
            py: [12, 13, 4, 12, 5],
            pz: [0, 0, 1, 0, 0],
            nx: [0, 0, 8, 4, 0],
            ny: [0, 2, 4, 4, 2],
            nz: [0, 0, 1, 1, -1]
          },
          {
            size: 3,
            px: [12, 13, 7],
            py: [13, 18, 6],
            pz: [0, 0, 1],
            nx: [13, 5, 6],
            ny: [16, 3, 8],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [10, 12, 9, 13, 11],
            py: [3, 3, 3, 3, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [3, 4, 15, 4, 4],
            ny: [2, 5, 10, 4, 4],
            nz: [2, 1, 0, 1, -1]
          },
          {
            size: 5,
            px: [12, 12, 12, 3, 12],
            py: [7, 9, 8, 3, 10],
            pz: [0, 0, 0, 2, 0],
            nx: [4, 8, 15, 9, 9],
            ny: [4, 4, 8, 8, 8],
            nz: [1, 1, 0, 0, -1]
          },
          {
            size: 5,
            px: [6, 3, 4, 4, 2],
            py: [22, 12, 13, 14, 7],
            pz: [0, 0, 0, 0, 1],
            nx: [2, 0, 1, 1, 1],
            ny: [23, 5, 22, 21, 21],
            nz: [0, 2, 0, 0, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [8, 8],
            pz: [1, -1],
            nx: [3, 4],
            ny: [4, 10],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [11, 11, 11, 11, 0],
            py: [10, 12, 11, 13, 2],
            pz: [0, 0, 0, -1, -1],
            nx: [8, 13, 13, 13, 13],
            ny: [10, 8, 9, 11, 10],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [16, 16, 15, 17, 18],
            py: [12, 23, 11, 12, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 8, 9, 3, 13],
            ny: [4, 4, 12, 3, 10],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 4,
            px: [17, 16, 6, 5],
            py: [14, 13, 4, 5],
            pz: [0, 0, -1, -1],
            nx: [8, 15, 4, 7],
            ny: [10, 14, 4, 8],
            nz: [1, 0, 2, 1]
          },
          {
            size: 5,
            px: [20, 10, 20, 21, 19],
            py: [14, 7, 13, 12, 22],
            pz: [0, 1, 0, 0, 0],
            nx: [22, 23, 11, 23, 23],
            ny: [23, 22, 11, 21, 20],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 4,
            px: [12, 13, 1, 18],
            py: [14, 23, 3, 5],
            pz: [0, -1, -1, -1],
            nx: [2, 10, 5, 9],
            ny: [2, 9, 8, 14],
            nz: [2, 0, 1, 0]
          },
          {
            size: 5,
            px: [10, 4, 7, 9, 8],
            py: [1, 0, 2, 0, 1],
            pz: [0, 1, 0, 0, 0],
            nx: [2, 3, 5, 3, 3],
            ny: [2, 4, 8, 3, 3],
            nz: [2, 1, 1, 1, -1]
          },
          {
            size: 4,
            px: [11, 2, 2, 11],
            py: [6, 4, 5, 7],
            pz: [0, 2, 2, 0],
            nx: [3, 0, 5, 3],
            ny: [4, 9, 8, 3],
            nz: [1, -1, -1, -1]
          },
          {
            size: 5,
            px: [12, 10, 9, 12, 12],
            py: [11, 2, 1, 10, 10],
            pz: [0, 1, 1, 0, -1],
            nx: [22, 11, 5, 22, 23],
            ny: [1, 1, 0, 0, 3],
            nz: [0, 1, 2, 0, 0]
          },
          {
            size: 4,
            px: [5, 10, 7, 11],
            py: [14, 3, 0, 4],
            pz: [0, -1, -1, -1],
            nx: [4, 4, 4, 4],
            ny: [17, 18, 15, 16],
            nz: [0, 0, 0, 0]
          },
          {
            size: 5,
            px: [2, 2, 3, 2, 2],
            py: [16, 12, 20, 15, 17],
            pz: [0, 0, 0, 0, 0],
            nx: [12, 8, 4, 15, 15],
            ny: [17, 4, 4, 8, 8],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 5,
            px: [12, 12, 1, 6, 12],
            py: [11, 10, 3, 6, 10],
            pz: [0, 0, -1, -1, -1],
            nx: [0, 0, 1, 0, 2],
            ny: [4, 0, 2, 1, 0],
            nz: [0, 2, 0, 1, 0]
          },
          {
            size: 5,
            px: [21, 20, 21, 21, 14],
            py: [9, 16, 11, 8, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [17, 6, 15, 0, 2],
            ny: [8, 23, 13, 2, 0],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 4,
            px: [6, 9, 9, 5],
            py: [14, 18, 23, 14],
            pz: [0, 0, 0, 0],
            nx: [9, 5, 5, 12],
            ny: [21, 5, 3, 1],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [12, 13],
            py: [4, 4],
            pz: [0, 0],
            nx: [4, 3],
            ny: [4, 1],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [7, 8, 11, 4, 10],
            py: [3, 3, 2, 1, 2],
            pz: [0, 0, 0, 1, 0],
            nx: [19, 20, 19, 20, 20],
            ny: [0, 3, 1, 2, 2],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [9, 1],
            py: [7, 4],
            pz: [1, -1],
            nx: [4, 7],
            ny: [5, 9],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [11, 10, 1, 5, 1],
            py: [10, 12, 6, 6, 5],
            pz: [0, 0, 1, 1, 1],
            nx: [16, 3, 2, 4, 4],
            ny: [10, 4, 2, 4, 4],
            nz: [0, 1, 2, 1, -1]
          },
          {
            size: 2,
            px: [15, 0],
            py: [17, 0],
            pz: [0, -1],
            nx: [7, 4],
            ny: [8, 5],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [8, 10, 9, 9, 9],
            py: [2, 2, 2, 1, 1],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 2, 3, 3, 2],
            ny: [0, 3, 2, 1, 4],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [11, 15, 17, 16],
            py: [8, 10, 11, 11],
            pz: [0, 0, 0, 0],
            nx: [14, 1, 1, 2],
            ny: [9, 5, 7, 0],
            nz: [0, -1, -1, -1]
          },
          {
            size: 3,
            px: [3, 5, 9],
            py: [8, 6, 12],
            pz: [0, 1, 0],
            nx: [3, 4, 18],
            ny: [4, 2, 22],
            nz: [1, -1, -1]
          },
          {
            size: 5,
            px: [6, 1, 7, 3, 3],
            py: [13, 4, 13, 7, 7],
            pz: [0, 2, 0, 1, -1],
            nx: [0, 0, 0, 0, 0],
            ny: [16, 15, 8, 13, 14],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 2,
            px: [5, 16],
            py: [13, 10],
            pz: [0, -1],
            nx: [3, 4],
            ny: [4, 5],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [5, 23, 11, 23, 23],
            py: [5, 12, 4, 16, 15],
            pz: [2, 0, 1, 0, 0],
            nx: [3, 2, 4, 5, 5],
            ny: [4, 2, 4, 11, 11],
            nz: [1, 2, 1, 1, -1]
          },
          {
            size: 4,
            px: [10, 10, 3, 23],
            py: [7, 7, 3, 16],
            pz: [1, -1, -1, -1],
            nx: [5, 23, 11, 22],
            ny: [4, 13, 7, 16],
            nz: [2, 0, 1, 0]
          },
          {
            size: 5,
            px: [15, 14, 13, 15, 16],
            py: [1, 0, 0, 0, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 9, 8, 8, 8],
            ny: [2, 4, 9, 4, 4],
            nz: [2, 1, 1, 1, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [5, 5],
            pz: [0, -1],
            nx: [3, 15],
            ny: [1, 8],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [6, 12],
            py: [6, 9],
            pz: [1, 0],
            nx: [10, 10],
            ny: [10, 10],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [1, 0, 0, 0, 0],
            py: [5, 4, 11, 9, 12],
            pz: [0, 1, 0, 0, 0],
            nx: [9, 8, 2, 4, 7],
            ny: [7, 7, 2, 4, 7],
            nz: [0, 0, 2, 1, 0]
          },
          {
            size: 2,
            px: [4, 8],
            py: [4, 7],
            pz: [2, 1],
            nx: [9, 8],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 6],
            py: [4, 1],
            pz: [2, -1],
            nx: [8, 6],
            ny: [7, 3],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [8, 5, 7, 6, 11],
            py: [12, 5, 13, 13, 22],
            pz: [0, 1, 0, 0, 0],
            nx: [23, 23, 23, 22, 22],
            ny: [20, 19, 21, 23, 23],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [3, 17],
            py: [6, 9],
            pz: [1, -1],
            nx: [3, 3],
            ny: [10, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [14, 11],
            py: [23, 5],
            pz: [0, 0],
            nx: [7, 3],
            ny: [10, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 4],
            py: [8, 8],
            pz: [1, 1],
            nx: [9, 4],
            ny: [15, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [4, 7],
            pz: [2, 1],
            nx: [2, 4],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [23, 11],
            py: [21, 10],
            pz: [0, 1],
            nx: [2, 3],
            ny: [11, 14],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [11, 11, 11, 3],
            py: [13, 12, 11, 4],
            pz: [0, 0, 0, -1],
            nx: [14, 13, 13, 6],
            ny: [13, 11, 10, 5],
            nz: [0, 0, 0, 1]
          },
          {
            size: 2,
            px: [4, 7],
            py: [3, 6],
            pz: [2, 1],
            nx: [9, 19],
            ny: [4, 14],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [10, 5, 7],
            py: [5, 0, 6],
            pz: [1, -1, -1],
            nx: [10, 21, 5],
            ny: [0, 5, 3],
            nz: [1, 0, 2]
          },
          {
            size: 2,
            px: [16, 13],
            py: [3, 15],
            pz: [0, -1],
            nx: [17, 7],
            ny: [23, 8],
            nz: [0, 1]
          },
          {
            size: 3,
            px: [4, 2, 2],
            py: [15, 7, 19],
            pz: [0, 1, -1],
            nx: [2, 8, 4],
            ny: [5, 14, 9],
            nz: [2, 0, 1]
          },
          {
            size: 3,
            px: [8, 3, 6],
            py: [10, 2, 4],
            pz: [0, 2, 1],
            nx: [3, 8, 4],
            ny: [4, 14, 9],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [14, 3],
            py: [18, 3],
            pz: [0, -1],
            nx: [12, 14],
            ny: [17, 9],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [7, 1, 10],
            py: [14, 10, 10],
            pz: [0, -1, -1],
            nx: [9, 6, 2],
            ny: [13, 18, 2],
            nz: [0, 0, 2]
          },
          {
            size: 2,
            px: [11, 8],
            py: [13, 11],
            pz: [0, -1],
            nx: [2, 4],
            ny: [7, 18],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [5, 4],
            py: [21, 17],
            pz: [0, 0],
            nx: [9, 3],
            ny: [5, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 6],
            py: [4, 0],
            pz: [0, -1],
            nx: [4, 3],
            ny: [2, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [2, 1],
            py: [1, 5],
            pz: [0, -1],
            nx: [0, 1],
            ny: [1, 0],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [18, 1],
            py: [13, 5],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 1],
            py: [4, 3, 2, 12, 15],
            pz: [1, 1, 2, 0, 0],
            nx: [5, 9, 4, 8, 8],
            ny: [3, 6, 3, 6, 6],
            nz: [1, 0, 1, 0, -1]
          },
          {
            size: 2,
            px: [2, 5],
            py: [0, 2],
            pz: [1, -1],
            nx: [2, 1],
            ny: [0, 1],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [7, 15, 4, 20],
            py: [8, 23, 4, 8],
            pz: [1, 0, 2, 0],
            nx: [6, 0, 3, 4],
            ny: [9, 2, 13, 6],
            nz: [0, -1, -1, -1]
          },
          {
            size: 4,
            px: [11, 11, 10, 20],
            py: [10, 9, 11, 8],
            pz: [0, 0, 0, -1],
            nx: [21, 20, 21, 21],
            ny: [18, 23, 19, 17],
            nz: [0, 0, 0, 0]
          },
          {
            size: 2,
            px: [3, 8],
            py: [7, 5],
            pz: [1, -1],
            nx: [3, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [5, 11],
            py: [3, 4],
            pz: [2, 1],
            nx: [8, 7],
            ny: [5, 12],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [4, 1],
            py: [1, 3],
            pz: [1, -1],
            nx: [3, 6],
            ny: [0, 0],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [19, 9],
            py: [16, 8],
            pz: [0, 1],
            nx: [14, 6],
            ny: [15, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 6],
            py: [13, 5],
            pz: [0, -1],
            nx: [5, 5],
            ny: [1, 2],
            nz: [2, 2]
          },
          {
            size: 5,
            px: [16, 14, 4, 15, 12],
            py: [1, 1, 1, 2, 1],
            pz: [0, 0, 2, 0, 0],
            nx: [6, 4, 3, 2, 10],
            ny: [22, 8, 2, 1, 7],
            nz: [0, 1, 1, 2, 0]
          },
          {
            size: 5,
            px: [6, 8, 6, 5, 5],
            py: [1, 0, 0, 1, 0],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 4, 4, 4, 8],
            ny: [4, 3, 2, 5, 10],
            nz: [2, 2, 2, 2, 1]
          },
          {
            size: 2,
            px: [9, 8],
            py: [17, 0],
            pz: [0, -1],
            nx: [2, 5],
            ny: [5, 8],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [8, 0],
            py: [7, 3],
            pz: [1, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [10, 21],
            py: [11, 20],
            pz: [1, 0],
            nx: [11, 4],
            ny: [17, 1],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [5, 10, 4, 17, 10],
            py: [3, 6, 3, 11, 5],
            pz: [1, 0, 1, 0, 0],
            nx: [21, 20, 9, 19, 10],
            ny: [4, 3, 0, 2, 1],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 2,
            px: [23, 23],
            py: [10, 10],
            pz: [0, -1],
            nx: [23, 23],
            ny: [21, 22],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [9, 20, 19, 20, 20],
            py: [0, 3, 1, 2, 2],
            pz: [1, 0, 0, 0, -1],
            nx: [11, 23, 11, 23, 5],
            ny: [1, 2, 0, 1, 0],
            nz: [1, 0, 1, 0, 2]
          },
          {
            size: 3,
            px: [6, 8, 7],
            py: [4, 10, 11],
            pz: [1, 0, 0],
            nx: [8, 3, 4],
            ny: [9, 4, 4],
            nz: [0, -1, -1]
          },
          {
            size: 4,
            px: [13, 13, 10, 4],
            py: [14, 23, 1, 5],
            pz: [0, -1, -1, -1],
            nx: [15, 14, 8, 8],
            ny: [13, 12, 8, 9],
            nz: [0, 0, 1, 1]
          },
          {
            size: 2,
            px: [11, 9],
            py: [5, 8],
            pz: [0, -1],
            nx: [7, 8],
            ny: [7, 4],
            nz: [0, 1]
          },
          {
            size: 5,
            px: [4, 8, 4, 7, 7],
            py: [2, 3, 3, 11, 11],
            pz: [2, 1, 2, 1, -1],
            nx: [0, 0, 1, 0, 0],
            ny: [4, 6, 15, 3, 2],
            nz: [1, 1, 0, 2, 2]
          },
          {
            size: 2,
            px: [6, 1],
            py: [12, 1],
            pz: [0, -1],
            nx: [1, 10],
            ny: [2, 11],
            nz: [2, 0]
          },
          {
            size: 5,
            px: [0, 0, 2, 3, 7],
            py: [0, 1, 4, 3, 11],
            pz: [0, -1, -1, -1, -1],
            nx: [9, 11, 9, 6, 12],
            ny: [2, 1, 1, 0, 2],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [10, 11],
            py: [4, 4],
            pz: [0, 0],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [1, 1, 1, 1, 1],
            py: [15, 10, 19, 16, 18],
            pz: [0, 1, 0, 0, 0],
            nx: [4, 5, 3, 5, 6],
            ny: [4, 19, 9, 18, 19],
            nz: [1, 0, 1, 0, -1]
          },
          {
            size: 5,
            px: [12, 12, 12, 12, 20],
            py: [11, 12, 13, 13, 18],
            pz: [0, 0, 0, -1, -1],
            nx: [0, 0, 0, 0, 0],
            ny: [4, 2, 7, 6, 12],
            nz: [1, 2, 1, 1, 0]
          },
          {
            size: 2,
            px: [0, 0],
            py: [9, 11],
            pz: [0, 0],
            nx: [10, 4],
            ny: [5, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 8],
            py: [9, 6],
            pz: [0, 1],
            nx: [13, 13],
            ny: [10, 10],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [5, 3],
            pz: [1, 2],
            nx: [3, 3],
            ny: [5, 5],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [19, 9],
            py: [10, 6],
            pz: [0, 1],
            nx: [4, 1],
            ny: [2, 2],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [14, 4],
            py: [19, 12],
            pz: [0, -1],
            nx: [14, 8],
            ny: [17, 10],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [4, 2, 13, 2],
            py: [12, 6, 9, 3],
            pz: [0, 1, -1, -1],
            nx: [1, 0, 1, 0],
            ny: [16, 14, 11, 15],
            nz: [0, 0, 1, 0]
          },
          {
            size: 2,
            px: [3, 3],
            py: [8, 7],
            pz: [1, 1],
            nx: [4, 4],
            ny: [4, 8],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [9, 11, 12, 6, 10],
            py: [2, 1, 2, 1, 2],
            pz: [0, 0, 0, 1, 0],
            nx: [4, 6, 4, 6, 2],
            ny: [4, 0, 9, 1, 8],
            nz: [0, 0, 1, 0, 1]
          },
          {
            size: 5,
            px: [4, 4, 7, 2, 2],
            py: [19, 20, 23, 8, 9],
            pz: [0, 0, 0, 1, 1],
            nx: [7, 0, 5, 6, 2],
            ny: [10, 5, 4, 1, 8],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [18, 18, 17, 18, 18],
            py: [15, 16, 14, 20, 17],
            pz: [0, 0, 0, 0, 0],
            nx: [15, 2, 2, 5, 2],
            ny: [8, 0, 2, 9, 4],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 4,
            px: [13, 13, 13, 18],
            py: [11, 12, 12, 20],
            pz: [0, 0, -1, -1],
            nx: [1, 3, 10, 10],
            ny: [1, 6, 12, 11],
            nz: [2, 0, 0, 0]
          },
          {
            size: 2,
            px: [8, 9],
            py: [0, 1],
            pz: [1, 1],
            nx: [19, 4],
            ny: [2, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [4, 2],
            pz: [1, 2],
            nx: [8, 4],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [23, 11, 22, 13, 13],
            py: [8, 3, 3, 12, 12],
            pz: [0, 1, 0, 0, -1],
            nx: [15, 7, 14, 13, 8],
            ny: [7, 3, 6, 6, 3],
            nz: [0, 1, 0, 0, 1]
          },
          {
            size: 3,
            px: [9, 11, 19],
            py: [7, 3, 0],
            pz: [1, -1, -1],
            nx: [23, 23, 11],
            ny: [16, 12, 7],
            nz: [0, 0, 1]
          },
          {
            size: 2,
            px: [15, 8],
            py: [23, 7],
            pz: [0, -1],
            nx: [4, 3],
            ny: [5, 4],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [4, 10],
            py: [6, 13],
            pz: [1, -1],
            nx: [2, 3],
            ny: [4, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 1],
            py: [11, 2],
            pz: [1, 2],
            nx: [9, 2],
            ny: [5, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [22, 22],
            py: [22, 21],
            pz: [0, 0],
            nx: [3, 0],
            ny: [5, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [20, 10],
            py: [12, 6],
            pz: [0, 1],
            nx: [20, 10],
            ny: [23, 11],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [10, 3, 3, 4],
            py: [5, 3, 4, 9],
            pz: [0, -1, -1, -1],
            nx: [14, 4, 3, 11],
            ny: [2, 1, 1, 3],
            nz: [0, 2, 2, 0]
          },
          {
            size: 3,
            px: [15, 15, 3],
            py: [1, 1, 4],
            pz: [0, -1, -1],
            nx: [7, 4, 4],
            ny: [8, 2, 3],
            nz: [1, 2, 2]
          },
          {
            size: 3,
            px: [0, 0, 0],
            py: [3, 4, 6],
            pz: [2, 2, 1],
            nx: [0, 21, 4],
            ny: [23, 14, 3],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [4, 4, 5, 3, 4],
            py: [9, 11, 8, 4, 8],
            pz: [1, 1, 1, 2, 1],
            nx: [21, 21, 10, 19, 19],
            ny: [3, 4, 1, 0, 0],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 4,
            px: [21, 20, 20, 21],
            py: [18, 21, 20, 17],
            pz: [0, 0, 0, 0],
            nx: [8, 1, 4, 2],
            ny: [10, 0, 2, 4],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 14],
            pz: [1, 0],
            nx: [3, 5],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [12, 0, 23],
            py: [20, 2, 13],
            pz: [0, -1, -1],
            nx: [12, 2, 9],
            ny: [19, 2, 7],
            nz: [0, 2, 0]
          },
          {
            size: 2,
            px: [0, 6],
            py: [22, 11],
            pz: [0, -1],
            nx: [20, 18],
            ny: [12, 23],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [9, 15, 15, 16, 8],
            py: [2, 1, 2, 2, 1],
            pz: [1, 0, 0, 0, 1],
            nx: [1, 1, 1, 1, 1],
            ny: [16, 10, 17, 18, 18],
            nz: [0, 1, 0, 0, -1]
          },
          {
            size: 5,
            px: [10, 5, 3, 5, 8],
            py: [14, 2, 1, 4, 1],
            pz: [0, -1, -1, -1, -1],
            nx: [23, 23, 23, 23, 23],
            ny: [18, 15, 16, 14, 17],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [2, 2, 2, 3, 2],
            py: [16, 17, 15, 20, 11],
            pz: [0, 0, 0, 0, 1],
            nx: [8, 22, 2, 1, 23],
            ny: [20, 11, 5, 0, 17],
            nz: [0, -1, -1, -1, -1]
          }
        ],
        alpha: [
          -1.299972,
          1.299972,
          -7.630804e-1,
          7.630804e-1,
          -5.530378e-1,
          5.530378e-1,
          -5.444703e-1,
          5.444703e-1,
          -5.207701e-1,
          5.207701e-1,
          -5.035143e-1,
          5.035143e-1,
          -4.514416e-1,
          4.514416e-1,
          -4.897723e-1,
          4.897723e-1,
          -5.006264e-1,
          5.006264e-1,
          -4.626049e-1,
          4.626049e-1,
          -4.375402e-1,
          4.375402e-1,
          -3.742565e-1,
          3.742565e-1,
          -3.873996e-1,
          3.873996e-1,
          -3.715484e-1,
          3.715484e-1,
          -3.56248e-1,
          3.56248e-1,
          -3.216189e-1,
          3.216189e-1,
          -3.983409e-1,
          3.983409e-1,
          -3.191891e-1,
          3.191891e-1,
          -3.242173e-1,
          3.242173e-1,
          -3.52804e-1,
          3.52804e-1,
          -3.562318e-1,
          3.562318e-1,
          -3.592398e-1,
          3.592398e-1,
          -2.557584e-1,
          2.557584e-1,
          -2.747951e-1,
          2.747951e-1,
          -2.747554e-1,
          2.747554e-1,
          -2.980481e-1,
          2.980481e-1,
          -2.88767e-1,
          2.88767e-1,
          -3.895318e-1,
          3.895318e-1,
          -2.786896e-1,
          2.786896e-1,
          -2.763841e-1,
          2.763841e-1,
          -2.704816e-1,
          2.704816e-1,
          -2.075489e-1,
          2.075489e-1,
          -3.104773e-1,
          3.104773e-1,
          -2.580337e-1,
          2.580337e-1,
          -2.448334e-1,
          2.448334e-1,
          -3.054279e-1,
          3.054279e-1,
          -2.335804e-1,
          2.335804e-1,
          -2.972322e-1,
          2.972322e-1,
          -2.270521e-1,
          2.270521e-1,
          -2.134621e-1,
          2.134621e-1,
          -2.261655e-1,
          2.261655e-1,
          -2.091024e-1,
          2.091024e-1,
          -2.478928e-1,
          2.478928e-1,
          -2.468972e-1,
          2.468972e-1,
          -1.919746e-1,
          1.919746e-1,
          -2.756623e-1,
          2.756623e-1,
          -2.629717e-1,
          2.629717e-1,
          -2.198653e-1,
          2.198653e-1,
          -2.174434e-1,
          2.174434e-1,
          -2.193626e-1,
          2.193626e-1,
          -1.956262e-1,
          1.956262e-1,
          -1.720459e-1,
          1.720459e-1,
          -1.781067e-1,
          1.781067e-1,
          -1.773484e-1,
          1.773484e-1,
          -1.793871e-1,
          1.793871e-1,
          -1.973396e-1,
          1.973396e-1,
          -2.397262e-1,
          2.397262e-1,
          -2.164685e-1,
          2.164685e-1,
          -2.214348e-1,
          2.214348e-1,
          -2.265941e-1,
          2.265941e-1,
          -2.075436e-1,
          2.075436e-1,
          -2.24407e-1,
          2.24407e-1,
          -2.291992e-1,
          2.291992e-1,
          -2.223506e-1,
          2.223506e-1,
          -1.639398e-1,
          1.639398e-1,
          -1.732374e-1,
          1.732374e-1,
          -1.808631e-1,
          1.808631e-1,
          -1.860962e-1,
          1.860962e-1,
          -1.781604e-1,
          1.781604e-1,
          -2.108322e-1,
          2.108322e-1,
          -2.38639e-1,
          2.38639e-1,
          -1.942083e-1,
          1.942083e-1,
          -1.949161e-1,
          1.949161e-1,
          -1.953729e-1,
          1.953729e-1,
          -2.317591e-1,
          2.317591e-1,
          -2.335136e-1,
          2.335136e-1,
          -2.282835e-1,
          2.282835e-1,
          -2.148716e-1,
          2.148716e-1,
          -1.588127e-1,
          1.588127e-1,
          -1.566765e-1,
          1.566765e-1,
          -1.644839e-1,
          1.644839e-1,
          -2.386947e-1,
          2.386947e-1,
          -1.704126e-1,
          1.704126e-1,
          -2.213945e-1,
          2.213945e-1,
          -1.740398e-1,
          1.740398e-1,
          -2.451678e-1,
          2.451678e-1,
          -2.120524e-1,
          2.120524e-1,
          -1.886646e-1,
          1.886646e-1,
          -2.824447e-1,
          2.824447e-1,
          -1.900364e-1,
          1.900364e-1,
          -2.179183e-1,
          2.179183e-1,
          -2.257696e-1,
          2.257696e-1,
          -2.023404e-1,
          2.023404e-1,
          -1.886901e-1,
          1.886901e-1,
          -1.850663e-1,
          1.850663e-1,
          -2.035414e-1,
          2.035414e-1,
          -1.930174e-1,
          1.930174e-1,
          -1.898282e-1,
          1.898282e-1,
          -1.66664e-1,
          1.66664e-1,
          -1.646143e-1,
          1.646143e-1,
          -1.543475e-1,
          1.543475e-1,
          -1.366289e-1,
          1.366289e-1,
          -1.636837e-1,
          1.636837e-1,
          -2.547716e-1,
          2.547716e-1,
          -1.281869e-1,
          1.281869e-1,
          -1.509159e-1,
          1.509159e-1,
          -1.447827e-1,
          1.447827e-1,
          -1.626126e-1,
          1.626126e-1,
          -2.387014e-1,
          2.387014e-1,
          -2.57116e-1,
          2.57116e-1,
          -1.719175e-1,
          1.719175e-1,
          -1.646742e-1,
          1.646742e-1,
          -1.717041e-1,
          1.717041e-1,
          -2.039217e-1,
          2.039217e-1,
          -1.796907e-1,
          1.796907e-1
        ]
      },
      {
        count: 153,
        threshold: -4.971032,
        feature: [
          {
            size: 5,
            px: [14, 13, 18, 10, 16],
            py: [2, 2, 13, 3, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [21, 7, 14, 23, 23],
            ny: [16, 7, 8, 3, 13],
            nz: [0, 1, 0, 0, 0]
          },
          {
            size: 5,
            px: [12, 12, 12, 15, 14],
            py: [9, 10, 11, 3, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [9, 9, 8, 14, 3],
            ny: [9, 8, 5, 9, 5],
            nz: [0, 0, 1, 0, 2]
          },
          {
            size: 5,
            px: [5, 11, 7, 6, 8],
            py: [12, 8, 12, 12, 11],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 4, 3, 9, 9],
            ny: [4, 4, 4, 9, 9],
            nz: [1, 1, 1, 0, -1]
          },
          {
            size: 5,
            px: [9, 8, 4, 10, 6],
            py: [2, 2, 1, 3, 13],
            pz: [0, 0, 1, 0, 0],
            nx: [1, 1, 5, 1, 1],
            ny: [2, 3, 8, 4, 16],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 5,
            px: [3, 16, 6, 17, 15],
            py: [2, 17, 4, 12, 12],
            pz: [2, 0, 1, 0, 0],
            nx: [4, 8, 15, 1, 1],
            ny: [4, 4, 8, 16, 16],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 4,
            px: [18, 15, 8, 17],
            py: [12, 23, 6, 12],
            pz: [0, 0, 1, 0],
            nx: [15, 4, 10, 5],
            ny: [21, 8, 14, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 5,
            px: [18, 17, 9, 19, 19],
            py: [3, 1, 0, 3, 3],
            pz: [0, 0, 1, 0, -1],
            nx: [22, 11, 23, 23, 23],
            ny: [0, 1, 2, 3, 4],
            nz: [0, 1, 0, 0, 0]
          },
          {
            size: 4,
            px: [9, 5, 5, 10],
            py: [18, 15, 14, 18],
            pz: [0, 0, 0, 0],
            nx: [10, 11, 2, 0],
            ny: [16, 7, 12, 7],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [2, 12],
            py: [4, 6],
            pz: [2, 0],
            nx: [3, 12],
            ny: [4, 19],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [3, 4, 5, 2, 2],
            py: [3, 3, 3, 1, 1],
            pz: [0, 0, 0, 1, -1],
            nx: [0, 0, 1, 0, 0],
            ny: [3, 4, 0, 1, 2],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 5,
            px: [12, 12, 12, 8, 10],
            py: [13, 12, 12, 1, 18],
            pz: [0, 0, -1, -1, -1],
            nx: [13, 8, 7, 14, 9],
            ny: [10, 10, 7, 13, 4],
            nz: [0, 1, 1, 0, 1]
          },
          {
            size: 5,
            px: [15, 4, 12, 14, 12],
            py: [12, 3, 9, 10, 8],
            pz: [0, 2, 0, 0, 0],
            nx: [14, 7, 11, 2, 9],
            ny: [8, 4, 7, 5, 4],
            nz: [0, 1, -1, -1, -1]
          },
          {
            size: 3,
            px: [3, 9, 7],
            py: [7, 23, 15],
            pz: [1, -1, -1],
            nx: [4, 4, 2],
            ny: [9, 7, 5],
            nz: [1, 1, 2]
          },
          {
            size: 3,
            px: [5, 17, 5],
            py: [3, 23, 4],
            pz: [2, 0, 2],
            nx: [23, 2, 4],
            ny: [23, 16, 4],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [4, 9, 9, 10, 8],
            py: [1, 0, 1, 0, 2],
            pz: [1, 0, 0, 0, 0],
            nx: [2, 5, 4, 2, 2],
            ny: [2, 19, 11, 4, 1],
            nz: [2, 0, 1, 2, 2]
          },
          {
            size: 5,
            px: [8, 3, 8, 4, 7],
            py: [23, 9, 13, 8, 16],
            pz: [0, 1, 0, 1, 0],
            nx: [8, 2, 5, 3, 2],
            ny: [8, 15, 1, 1, 1],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [14, 5],
            pz: [0, -1],
            nx: [1, 9],
            ny: [3, 13],
            nz: [2, 0]
          },
          {
            size: 5,
            px: [5, 8, 1, 8, 6],
            py: [12, 12, 3, 23, 12],
            pz: [0, 0, 2, 0, 0],
            nx: [1, 1, 2, 1, 1],
            ny: [22, 21, 23, 20, 20],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [14, 21, 19, 21, 20],
            py: [13, 8, 20, 10, 7],
            pz: [0, 0, 0, 0, 0],
            nx: [16, 0, 14, 23, 1],
            ny: [8, 1, 23, 10, 20],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [15, 16, 13, 14, 14],
            py: [3, 3, 3, 3, 3],
            pz: [0, 0, 0, 0, -1],
            nx: [18, 19, 18, 9, 17],
            ny: [2, 2, 1, 1, 0],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [17, 9],
            py: [14, 4],
            pz: [0, -1],
            nx: [9, 18],
            ny: [4, 18],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [21, 20],
            py: [17, 21],
            pz: [0, 0],
            nx: [12, 3],
            ny: [17, 10],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 1],
            py: [10, 4],
            pz: [1, 2],
            nx: [4, 1],
            ny: [10, 5],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [7, 8, 4, 9, 9],
            py: [2, 2, 0, 2, 2],
            pz: [0, 0, 1, 0, -1],
            nx: [5, 5, 4, 6, 3],
            ny: [0, 1, 2, 0, 0],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 2,
            px: [2, 5],
            py: [3, 5],
            pz: [2, -1],
            nx: [3, 2],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [0, 1, 3, 4, 4],
            pz: [2, 2, 1, 1, -1],
            nx: [20, 20, 19, 20, 19],
            ny: [21, 20, 23, 19, 22],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [9, 18],
            py: [8, 16],
            pz: [1, 0],
            nx: [14, 6],
            ny: [15, 16],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [3, 4, 7],
            py: [3, 3, 9],
            pz: [2, 2, 1],
            nx: [8, 9, 7],
            ny: [4, 11, 4],
            nz: [1, -1, -1]
          },
          {
            size: 5,
            px: [6, 14, 4, 7, 7],
            py: [4, 23, 3, 6, 6],
            pz: [1, 0, 2, 1, -1],
            nx: [2, 0, 2, 1, 3],
            ny: [20, 4, 21, 10, 23],
            nz: [0, 2, 0, 1, 0]
          },
          {
            size: 5,
            px: [2, 4, 8, 9, 10],
            py: [3, 8, 13, 23, 23],
            pz: [2, 1, 0, 0, 0],
            nx: [10, 4, 0, 3, 3],
            ny: [21, 3, 0, 3, 23],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [11, 10, 11],
            py: [6, 5, 5],
            pz: [0, 0, 0],
            nx: [14, 6, 1],
            ny: [7, 9, 5],
            nz: [0, 1, -1]
          },
          {
            size: 5,
            px: [11, 11, 11, 11, 6],
            py: [11, 12, 10, 13, 6],
            pz: [0, 0, 0, 0, 1],
            nx: [9, 13, 13, 13, 4],
            ny: [4, 9, 10, 11, 2],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 11],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [1, 2],
            py: [4, 11],
            pz: [2, 0],
            nx: [8, 8],
            ny: [15, 15],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [12, 12, 13, 12, 12],
            py: [10, 11, 13, 12, 12],
            pz: [0, 0, 0, 0, -1],
            nx: [0, 0, 0, 1, 0],
            ny: [13, 2, 12, 5, 14],
            nz: [0, 2, 0, 0, 0]
          },
          {
            size: 5,
            px: [0, 0, 0, 1, 1],
            py: [4, 3, 11, 15, 13],
            pz: [1, 2, 0, 0, 0],
            nx: [2, 3, 3, 1, 0],
            ny: [2, 4, 4, 5, 14],
            nz: [2, 1, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 11],
            py: [12, 10],
            pz: [0, -1],
            nx: [1, 2],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [18, 8, 9, 9, 9],
            py: [15, 7, 8, 10, 7],
            pz: [0, 1, 1, 1, 1],
            nx: [22, 23, 21, 22, 11],
            ny: [20, 16, 23, 19, 9],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [14, 12, 13, 14, 15],
            py: [1, 0, 0, 0, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 9, 4, 7, 7],
            ny: [2, 3, 1, 8, 8],
            nz: [2, 1, 2, 1, -1]
          },
          {
            size: 2,
            px: [13, 9],
            py: [14, 19],
            pz: [0, -1],
            nx: [6, 10],
            ny: [0, 2],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [13, 12],
            py: [4, 4],
            pz: [0, 0],
            nx: [3, 3],
            ny: [1, 1],
            nz: [2, -1]
          },
          {
            size: 3,
            px: [14, 5, 5],
            py: [18, 3, 4],
            pz: [0, -1, -1],
            nx: [8, 7, 8],
            ny: [4, 8, 10],
            nz: [1, 1, 1]
          },
          {
            size: 2,
            px: [8, 18],
            py: [6, 11],
            pz: [1, 0],
            nx: [9, 1],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [16, 11],
            py: [9, 7],
            pz: [0, 0],
            nx: [7, 7],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [23, 11, 23, 11, 23],
            py: [13, 4, 12, 7, 10],
            pz: [0, 1, 0, 1, 0],
            nx: [7, 4, 8, 15, 15],
            ny: [9, 2, 4, 8, 8],
            nz: [0, 2, 1, 0, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [1, 0],
            pz: [0, 1],
            nx: [4, 1],
            ny: [1, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [7, 6],
            pz: [0, 1],
            nx: [6, 4],
            ny: [9, 11],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [5, 6, 5, 5],
            py: [8, 6, 11, 6],
            pz: [1, 1, 1, 0],
            nx: [23, 0, 4, 5],
            ny: [0, 2, 2, 1],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [18, 4],
            py: [13, 3],
            pz: [0, -1],
            nx: [15, 4],
            ny: [11, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [4, 0],
            py: [8, 0],
            pz: [1, -1],
            nx: [9, 2],
            ny: [15, 5],
            nz: [0, 2]
          },
          {
            size: 5,
            px: [15, 15, 16, 14, 14],
            py: [0, 1, 1, 0, 0],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 4, 8, 8, 15],
            ny: [4, 5, 4, 11, 23],
            nz: [2, 2, 1, 1, 0]
          },
          {
            size: 4,
            px: [12, 11, 3, 14],
            py: [14, 22, 1, 0],
            pz: [0, -1, -1, -1],
            nx: [8, 15, 7, 16],
            ny: [2, 3, 1, 3],
            nz: [1, 0, 1, 0]
          },
          {
            size: 2,
            px: [5, 12],
            py: [6, 17],
            pz: [1, -1],
            nx: [2, 1],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [13, 12, 12, 7, 7],
            py: [5, 6, 5, 14, 14],
            pz: [0, 0, 0, 0, -1],
            nx: [10, 3, 10, 1, 10],
            ny: [13, 8, 11, 3, 10],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [4, 4],
            py: [15, 0],
            pz: [0, -1],
            nx: [4, 4],
            ny: [16, 17],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [1, 4, 2, 1, 2],
            py: [4, 0, 1, 1, 0],
            pz: [1, 1, 1, 2, 1],
            nx: [4, 9, 1, 5, 1],
            ny: [3, 4, 4, 5, 5],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [10, 3],
            py: [3, 1],
            pz: [0, 2],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [16, 0],
            py: [21, 0],
            pz: [0, -1],
            nx: [6, 8],
            ny: [8, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [7, 11],
            py: [4, 18],
            pz: [0, -1],
            nx: [5, 7],
            ny: [0, 2],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [9, 7],
            py: [0, 3],
            pz: [1, -1],
            nx: [20, 10],
            ny: [0, 1],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [10, 4, 1, 5],
            py: [0, 6, 8, 4],
            pz: [1, -1, -1, -1],
            nx: [6, 15, 4, 14],
            ny: [3, 5, 1, 5],
            nz: [1, 0, 2, 0]
          },
          {
            size: 2,
            px: [4, 4],
            py: [3, 4],
            pz: [2, 2],
            nx: [9, 2],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [3, 4],
            pz: [0, -1],
            nx: [8, 6],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 0],
            py: [6, 3],
            pz: [1, 2],
            nx: [0, 7],
            ny: [7, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [7, 3],
            pz: [1, -1],
            nx: [15, 4],
            ny: [14, 4],
            nz: [0, 2]
          },
          {
            size: 4,
            px: [3, 1, 2, 2],
            py: [20, 7, 18, 17],
            pz: [0, 1, 0, 0],
            nx: [9, 5, 5, 4],
            ny: [5, 4, 18, 4],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [5, 4],
            py: [3, 1],
            pz: [2, -1],
            nx: [23, 23],
            ny: [14, 13],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 4],
            py: [6, 1],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [22, 22, 11, 11, 11],
            py: [12, 13, 4, 6, 6],
            pz: [0, 0, 1, 1, -1],
            nx: [4, 4, 4, 4, 3],
            ny: [16, 15, 18, 14, 11],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 2,
            px: [4, 10],
            py: [0, 1],
            pz: [1, 0],
            nx: [2, 2],
            ny: [2, 2],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [15, 6],
            py: [4, 4],
            pz: [0, -1],
            nx: [15, 4],
            ny: [2, 1],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [11, 2],
            py: [10, 20],
            pz: [0, -1],
            nx: [4, 9],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 19],
            py: [3, 8],
            pz: [2, 0],
            nx: [8, 21],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [4, 6, 7, 6, 2],
            py: [6, 15, 13, 14, 3],
            pz: [1, 0, 0, 0, -1],
            nx: [21, 22, 19, 21, 10],
            ny: [6, 12, 0, 3, 2],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [8, 12, 15, 14, 13],
            py: [0, 0, 0, 0, 0],
            pz: [1, 0, 0, 0, 0],
            nx: [4, 3, 1, 3, 4],
            ny: [19, 16, 3, 15, 4],
            nz: [0, 0, 2, 0, 1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [2, 3],
            pz: [2, 2],
            nx: [8, 4],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [0, 0, 0, 5],
            py: [10, 9, 11, 21],
            pz: [1, 1, -1, -1],
            nx: [12, 4, 3, 11],
            ny: [3, 1, 1, 3],
            nz: [0, 2, 2, 0]
          },
          {
            size: 2,
            px: [3, 1],
            py: [0, 0],
            pz: [1, 2],
            nx: [1, 4],
            ny: [2, 1],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [2, 5, 1, 0, 1],
            py: [14, 23, 7, 5, 9],
            pz: [0, 0, 1, 1, 1],
            nx: [0, 0, 7, 9, 11],
            ny: [23, 22, 4, 9, 3],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [8, 9],
            py: [7, 1],
            pz: [1, -1],
            nx: [8, 8],
            ny: [8, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [11, 9],
            py: [11, 3],
            pz: [1, -1],
            nx: [3, 2],
            ny: [14, 10],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [2, 4, 5, 4],
            py: [8, 20, 22, 16],
            pz: [1, 0, 0, 0],
            nx: [8, 2, 11, 3],
            ny: [7, 4, 15, 4],
            nz: [0, -1, -1, -1]
          },
          {
            size: 3,
            px: [1, 2, 3],
            py: [2, 1, 0],
            pz: [0, 0, 0],
            nx: [0, 0, 15],
            ny: [1, 0, 11],
            nz: [0, 0, -1]
          },
          {
            size: 2,
            px: [12, 22],
            py: [6, 7],
            pz: [0, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 3,
            px: [13, 0, 5],
            py: [19, 10, 2],
            pz: [0, -1, -1],
            nx: [3, 4, 6],
            ny: [5, 5, 9],
            nz: [2, 2, 1]
          },
          {
            size: 2,
            px: [8, 15],
            py: [8, 22],
            pz: [1, 0],
            nx: [7, 4],
            ny: [10, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [7, 6],
            pz: [1, 1],
            nx: [10, 1],
            ny: [9, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 11],
            py: [4, 3],
            pz: [0, -1],
            nx: [5, 9],
            ny: [0, 1],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [14, 13, 14, 12, 15],
            py: [1, 2, 2, 2, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 8, 4, 7, 4],
            ny: [2, 4, 3, 4, 4],
            nz: [2, 1, 2, 1, -1]
          },
          {
            size: 3,
            px: [13, 8, 2],
            py: [14, 5, 8],
            pz: [0, -1, -1],
            nx: [6, 8, 9],
            ny: [3, 2, 2],
            nz: [0, 0, 0]
          },
          {
            size: 3,
            px: [3, 6, 8],
            py: [7, 4, 12],
            pz: [1, 1, 0],
            nx: [3, 8, 9],
            ny: [5, 2, 2],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [13, 4],
            py: [16, 3],
            pz: [0, 2],
            nx: [13, 7],
            ny: [15, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 0],
            py: [7, 9],
            pz: [1, -1],
            nx: [2, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [3, 6, 8, 7, 7],
            py: [0, 1, 0, 0, 0],
            pz: [1, 0, 0, 0, -1],
            nx: [7, 9, 4, 3, 4],
            ny: [9, 7, 4, 2, 2],
            nz: [1, 1, 1, 2, 2]
          },
          {
            size: 3,
            px: [3, 4, 16],
            py: [4, 4, 6],
            pz: [1, 2, 0],
            nx: [2, 2, 2],
            ny: [0, 0, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [1, 0],
            pz: [2, 2],
            nx: [5, 5],
            ny: [2, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 3],
            py: [7, 20],
            pz: [1, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [8, 21],
            py: [10, 18],
            pz: [0, -1],
            nx: [9, 4],
            ny: [10, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [6, 13],
            py: [6, 23],
            pz: [1, -1],
            nx: [10, 10],
            ny: [11, 12],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [10, 9, 5, 10, 10],
            py: [9, 13, 6, 10, 10],
            pz: [0, 0, 1, 0, -1],
            nx: [21, 21, 21, 10, 21],
            ny: [18, 20, 19, 11, 17],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [8, 8],
            py: [7, 6],
            pz: [1, 1],
            nx: [8, 1],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 4],
            py: [14, 7],
            pz: [0, -1],
            nx: [13, 13],
            ny: [13, 11],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 4],
            py: [4, 5],
            pz: [2, 2],
            nx: [12, 5],
            ny: [16, 2],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [1, 3, 20],
            py: [3, 9, 2],
            pz: [2, -1, -1],
            nx: [0, 0, 0],
            ny: [7, 4, 13],
            nz: [1, 2, 0]
          },
          {
            size: 2,
            px: [0, 0],
            py: [4, 2],
            pz: [1, 2],
            nx: [1, 0],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [8, 9, 11],
            py: [2, 1, 2],
            pz: [0, 0, 0],
            nx: [2, 2, 0],
            ny: [2, 2, 13],
            nz: [2, -1, -1]
          },
          {
            size: 2,
            px: [1, 10],
            py: [23, 5],
            pz: [0, -1],
            nx: [3, 6],
            ny: [1, 1],
            nz: [2, 1]
          },
          {
            size: 4,
            px: [13, 6, 3, 4],
            py: [8, 6, 4, 2],
            pz: [0, -1, -1, -1],
            nx: [1, 1, 1, 4],
            ny: [9, 7, 8, 20],
            nz: [1, 1, 1, 0]
          },
          {
            size: 5,
            px: [11, 4, 4, 10, 3],
            py: [9, 16, 13, 12, 7],
            pz: [0, 0, 0, 0, 0],
            nx: [7, 11, 3, 17, 4],
            ny: [8, 11, 9, 0, 4],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [6, 6],
            py: [6, 8],
            pz: [1, -1],
            nx: [0, 0],
            ny: [1, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [10, 5],
            py: [7, 2],
            pz: [0, -1],
            nx: [4, 13],
            ny: [5, 9],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [10, 5],
            py: [8, 2],
            pz: [1, -1],
            nx: [16, 4],
            ny: [14, 5],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [1, 1],
            py: [16, 15],
            pz: [0, 0],
            nx: [1, 20],
            ny: [23, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [4, 7],
            pz: [2, 1],
            nx: [2, 3],
            ny: [5, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [19, 8],
            py: [5, 4],
            pz: [0, -1],
            nx: [10, 10],
            ny: [1, 3],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [21, 21],
            py: [18, 16],
            pz: [0, 0],
            nx: [10, 3],
            ny: [17, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 2],
            py: [23, 4],
            pz: [0, 2],
            nx: [5, 11],
            ny: [3, 7],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [7, 0],
            py: [3, 2],
            pz: [0, -1],
            nx: [3, 6],
            ny: [1, 1],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [5, 9, 8, 9],
            py: [8, 12, 13, 18],
            pz: [0, 0, 0, 0],
            nx: [6, 5, 2, 5],
            ny: [8, 4, 7, 11],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [7, 2],
            py: [0, 0],
            pz: [0, 2],
            nx: [5, 5],
            ny: [3, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [12, 13],
            pz: [0, 0],
            nx: [9, 1],
            ny: [14, 3],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [8, 16, 9, 4, 15],
            py: [11, 13, 8, 4, 12],
            pz: [1, 0, 1, 2, 0],
            nx: [3, 3, 3, 3, 4],
            ny: [4, 2, 1, 3, 0],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [9, 5],
            py: [7, 6],
            pz: [1, -1],
            nx: [19, 8],
            ny: [17, 11],
            nz: [0, 1]
          },
          {
            size: 5,
            px: [14, 15, 12, 13, 13],
            py: [2, 2, 2, 2, 2],
            pz: [0, 0, 0, 0, -1],
            nx: [20, 9, 19, 20, 4],
            ny: [14, 2, 5, 15, 1],
            nz: [0, 1, 0, 0, 2]
          },
          {
            size: 2,
            px: [18, 8],
            py: [20, 7],
            pz: [0, 1],
            nx: [4, 9],
            ny: [2, 2],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [11, 5],
            pz: [1, 2],
            nx: [13, 19],
            ny: [20, 20],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [12, 11, 3],
            py: [20, 20, 5],
            pz: [0, 0, -1],
            nx: [11, 12, 6],
            ny: [21, 21, 10],
            nz: [0, 0, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 14],
            pz: [1, 0],
            nx: [3, 13],
            ny: [4, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 9],
            pz: [2, 1],
            nx: [2, 11],
            ny: [8, 6],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [5, 5],
            pz: [1, -1],
            nx: [0, 0],
            ny: [6, 3],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [11, 23],
            py: [5, 9],
            pz: [1, 0],
            nx: [8, 2],
            ny: [11, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 23],
            py: [12, 9],
            pz: [0, -1],
            nx: [11, 22],
            ny: [10, 21],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [12, 12],
            py: [7, 7],
            pz: [0, -1],
            nx: [5, 4],
            ny: [7, 10],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [9, 8],
            py: [18, 1],
            pz: [0, -1],
            nx: [5, 4],
            ny: [8, 10],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [16, 17],
            py: [11, 11],
            pz: [0, 0],
            nx: [15, 2],
            ny: [9, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 1],
            py: [3, 0],
            pz: [2, -1],
            nx: [9, 10],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [13, 13],
            py: [20, 21],
            pz: [0, -1],
            nx: [2, 2],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [20, 20, 4, 18, 19],
            py: [17, 16, 5, 22, 20],
            pz: [0, 0, 2, 0, 0],
            nx: [8, 11, 5, 6, 2],
            ny: [10, 15, 11, 10, 1],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [4, 4],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 3,
            px: [6, 5, 6],
            py: [8, 10, 10],
            pz: [1, 1, 1],
            nx: [11, 8, 22],
            ny: [19, 2, 15],
            nz: [0, -1, -1]
          },
          {
            size: 3,
            px: [5, 2, 13],
            py: [7, 10, 10],
            pz: [1, -1, -1],
            nx: [11, 11, 23],
            ny: [8, 9, 14],
            nz: [1, 1, 0]
          },
          {
            size: 5,
            px: [3, 6, 1, 5, 10],
            py: [7, 14, 1, 9, 2],
            pz: [1, -1, -1, -1, -1],
            nx: [11, 0, 1, 5, 1],
            ny: [14, 12, 18, 5, 19],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 3,
            px: [21, 21, 10],
            py: [16, 17, 10],
            pz: [0, 0, 1],
            nx: [5, 5, 1],
            ny: [9, 9, 18],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [6, 21],
            py: [6, 17],
            pz: [1, -1],
            nx: [20, 10],
            ny: [7, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [10, 11],
            py: [0, 0],
            pz: [1, -1],
            nx: [6, 13],
            ny: [2, 4],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [4, 4, 7, 9],
            py: [3, 4, 10, 3],
            pz: [2, 2, 1, 1],
            nx: [21, 2, 15, 5],
            ny: [0, 0, 0, 2],
            nz: [0, -1, -1, -1]
          },
          {
            size: 3,
            px: [11, 11, 11],
            py: [7, 6, 9],
            pz: [1, 1, 1],
            nx: [23, 4, 9],
            ny: [23, 5, 6],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [14, 15],
            py: [1, 1],
            pz: [0, 0],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [11, 23, 11, 23, 23],
            py: [11, 22, 10, 21, 20],
            pz: [1, 0, 1, 0, 0],
            nx: [10, 9, 19, 10, 10],
            ny: [10, 11, 20, 9, 9],
            nz: [1, 1, 0, 1, -1]
          },
          {
            size: 2,
            px: [7, 23],
            py: [13, 22],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [12, 1],
            py: [19, 0],
            pz: [0, -1],
            nx: [11, 12],
            ny: [22, 17],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [10, 8],
            py: [4, 3],
            pz: [1, -1],
            nx: [5, 23],
            ny: [2, 7],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [9, 10],
            py: [6, 20],
            pz: [1, -1],
            nx: [8, 8],
            ny: [4, 6],
            nz: [1, 1]
          }
        ],
        alpha: [
          -1.135386,
          1.135386,
          -9.0908e-1,
          9.0908e-1,
          -5.91378e-1,
          5.91378e-1,
          -5.556534e-1,
          5.556534e-1,
          -5.08415e-1,
          5.08415e-1,
          -4.464489e-1,
          4.464489e-1,
          -4.463241e-1,
          4.463241e-1,
          -4.985226e-1,
          4.985226e-1,
          -4.424638e-1,
          4.424638e-1,
          -4.300093e-1,
          4.300093e-1,
          -4.231341e-1,
          4.231341e-1,
          -4.087428e-1,
          4.087428e-1,
          -3.37448e-1,
          3.37448e-1,
          -3.230151e-1,
          3.230151e-1,
          -3.084427e-1,
          3.084427e-1,
          -3.235494e-1,
          3.235494e-1,
          -2.589281e-1,
          2.589281e-1,
          -2.970292e-1,
          2.970292e-1,
          -2.957065e-1,
          2.957065e-1,
          -3.997619e-1,
          3.997619e-1,
          -3.535901e-1,
          3.535901e-1,
          -2.725396e-1,
          2.725396e-1,
          -2.649725e-1,
          2.649725e-1,
          -3.103888e-1,
          3.103888e-1,
          -3.117775e-1,
          3.117775e-1,
          -2.58962e-1,
          2.58962e-1,
          -2.689202e-1,
          2.689202e-1,
          -2.127024e-1,
          2.127024e-1,
          -2.436322e-1,
          2.436322e-1,
          -3.120574e-1,
          3.120574e-1,
          -2.78601e-1,
          2.78601e-1,
          -2.649072e-1,
          2.649072e-1,
          -2.766509e-1,
          2.766509e-1,
          -2.367237e-1,
          2.367237e-1,
          -2.658049e-1,
          2.658049e-1,
          -2.103463e-1,
          2.103463e-1,
          -1.911522e-1,
          1.911522e-1,
          -2.535425e-1,
          2.535425e-1,
          -2.434696e-1,
          2.434696e-1,
          -2.180788e-1,
          2.180788e-1,
          -2.496873e-1,
          2.496873e-1,
          -2.700969e-1,
          2.700969e-1,
          -2.565479e-1,
          2.565479e-1,
          -2.737741e-1,
          2.737741e-1,
          -1.675507e-1,
          1.675507e-1,
          -2.551417e-1,
          2.551417e-1,
          -2.067648e-1,
          2.067648e-1,
          -1.636834e-1,
          1.636834e-1,
          -2.129306e-1,
          2.129306e-1,
          -1.656758e-1,
          1.656758e-1,
          -1.919369e-1,
          1.919369e-1,
          -2.031763e-1,
          2.031763e-1,
          -2.062327e-1,
          2.062327e-1,
          -2.57795e-1,
          2.57795e-1,
          -2.951823e-1,
          2.951823e-1,
          -2.02316e-1,
          2.02316e-1,
          -2.022234e-1,
          2.022234e-1,
          -2.132906e-1,
          2.132906e-1,
          -1.653278e-1,
          1.653278e-1,
          -1.648474e-1,
          1.648474e-1,
          -1.593352e-1,
          1.593352e-1,
          -1.73565e-1,
          1.73565e-1,
          -1.688778e-1,
          1.688778e-1,
          -1.519705e-1,
          1.519705e-1,
          -1.812202e-1,
          1.812202e-1,
          -1.967481e-1,
          1.967481e-1,
          -1.852954e-1,
          1.852954e-1,
          -2.31778e-1,
          2.31778e-1,
          -2.036251e-1,
          2.036251e-1,
          -1.609324e-1,
          1.609324e-1,
          -2.160205e-1,
          2.160205e-1,
          -2.02619e-1,
          2.02619e-1,
          -1.854761e-1,
          1.854761e-1,
          -1.832038e-1,
          1.832038e-1,
          -2.001141e-1,
          2.001141e-1,
          -1.418333e-1,
          1.418333e-1,
          -1.704773e-1,
          1.704773e-1,
          -1.586261e-1,
          1.586261e-1,
          -1.587582e-1,
          1.587582e-1,
          -1.899489e-1,
          1.899489e-1,
          -1.47716e-1,
          1.47716e-1,
          -2.260467e-1,
          2.260467e-1,
          -2.393598e-1,
          2.393598e-1,
          -1.582373e-1,
          1.582373e-1,
          -1.702498e-1,
          1.702498e-1,
          -1.737398e-1,
          1.737398e-1,
          -1.462529e-1,
          1.462529e-1,
          -1.396517e-1,
          1.396517e-1,
          -1.629625e-1,
          1.629625e-1,
          -1.446933e-1,
          1.446933e-1,
          -1.811657e-1,
          1.811657e-1,
          -1.336427e-1,
          1.336427e-1,
          -1.924813e-1,
          1.924813e-1,
          -1.45752e-1,
          1.45752e-1,
          -1.600259e-1,
          1.600259e-1,
          -1.297e-1,
          1.297e-1,
          -2.076199e-1,
          2.076199e-1,
          -1.51006e-1,
          1.51006e-1,
          -1.914568e-1,
          1.914568e-1,
          -2.138162e-1,
          2.138162e-1,
          -1.856916e-1,
          1.856916e-1,
          -1.843047e-1,
          1.843047e-1,
          -1.526846e-1,
          1.526846e-1,
          -1.32832e-1,
          1.32832e-1,
          -1.751311e-1,
          1.751311e-1,
          -1.643908e-1,
          1.643908e-1,
          -1.482706e-1,
          1.482706e-1,
          -1.622298e-1,
          1.622298e-1,
          -1.884979e-1,
          1.884979e-1,
          -1.633604e-1,
          1.633604e-1,
          -1.554166e-1,
          1.554166e-1,
          -1.405332e-1,
          1.405332e-1,
          -1.772398e-1,
          1.772398e-1,
          -1.410008e-1,
          1.410008e-1,
          -1.362301e-1,
          1.362301e-1,
          -1.709087e-1,
          1.709087e-1,
          -1.584613e-1,
          1.584613e-1,
          -1.188814e-1,
          1.188814e-1,
          -1.423888e-1,
          1.423888e-1,
          -1.345565e-1,
          1.345565e-1,
          -1.835986e-1,
          1.835986e-1,
          -1.445329e-1,
          1.445329e-1,
          -1.385826e-1,
          1.385826e-1,
          -1.558917e-1,
          1.558917e-1,
          -1.476053e-1,
          1.476053e-1,
          -1.370722e-1,
          1.370722e-1,
          -2.362666e-1,
          2.362666e-1,
          -2.907774e-1,
          2.907774e-1,
          -1.65636e-1,
          1.65636e-1,
          -1.644407e-1,
          1.644407e-1,
          -1.443394e-1,
          1.443394e-1,
          -1.438823e-1,
          1.438823e-1,
          -1.476964e-1,
          1.476964e-1,
          -1.956593e-1,
          1.956593e-1,
          -2.417519e-1,
          2.417519e-1,
          -1.659315e-1,
          1.659315e-1,
          -1.466254e-1,
          1.466254e-1,
          -2.034909e-1,
          2.034909e-1,
          -2.128771e-1,
          2.128771e-1,
          -1.665429e-1,
          1.665429e-1,
          -1.387131e-1,
          1.387131e-1,
          -1.298823e-1,
          1.298823e-1,
          -1.329495e-1,
          1.329495e-1,
          -1.769587e-1,
          1.769587e-1,
          -1.36653e-1,
          1.36653e-1,
          -1.254359e-1,
          1.254359e-1,
          -1.673022e-1,
          1.673022e-1,
          -1.602519e-1,
          1.602519e-1,
          -1.897245e-1,
          1.897245e-1,
          -1.893579e-1,
          1.893579e-1,
          -1.57935e-1,
          1.57935e-1,
          -1.472589e-1,
          1.472589e-1,
          -1.614193e-1,
          1.614193e-1
        ]
      },
      {
        count: 203,
        threshold: -4.769677,
        feature: [
          {
            size: 5,
            px: [12, 5, 14, 9, 7],
            py: [9, 13, 3, 1, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [1, 0, 5, 14, 9],
            ny: [5, 3, 8, 8, 9],
            nz: [2, 0, 1, 0, 0]
          },
          {
            size: 5,
            px: [14, 13, 11, 17, 12],
            py: [2, 2, 4, 13, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [7, 22, 8, 23, 22],
            ny: [8, 15, 11, 12, 3],
            nz: [1, 0, 1, 0, 0]
          },
          {
            size: 5,
            px: [9, 11, 11, 11, 16],
            py: [4, 8, 7, 9, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 8, 14, 9, 9],
            ny: [4, 4, 8, 8, 8],
            nz: [1, 1, 0, 0, -1]
          },
          {
            size: 5,
            px: [6, 12, 12, 8, 3],
            py: [11, 7, 8, 10, 2],
            pz: [0, 0, 0, 0, 2],
            nx: [8, 4, 4, 4, 0],
            ny: [4, 4, 4, 11, 0],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 5,
            px: [19, 17, 18, 9, 9],
            py: [3, 2, 3, 1, 1],
            pz: [0, 0, 0, 1, -1],
            nx: [21, 21, 10, 22, 22],
            ny: [1, 2, 0, 4, 3],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 2,
            px: [4, 7],
            py: [4, 6],
            pz: [2, 1],
            nx: [8, 7],
            ny: [4, 10],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [14, 17, 17, 13, 12],
            py: [18, 15, 16, 18, 18],
            pz: [0, 0, 0, 0, 0],
            nx: [13, 19, 5, 20, 6],
            ny: [16, 4, 1, 19, 0],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [6, 7, 4, 5, 5],
            py: [15, 23, 6, 12, 16],
            pz: [0, 0, 1, 0, 0],
            nx: [3, 14, 14, 6, 6],
            ny: [4, 11, 11, 9, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [16, 9, 6, 3, 11],
            py: [2, 2, 5, 3, 2],
            pz: [0, 0, 1, 2, 0],
            nx: [3, 4, 2, 5, 5],
            ny: [4, 11, 2, 8, 8],
            nz: [1, 1, 2, 1, -1]
          },
          {
            size: 5,
            px: [6, 1, 5, 3, 3],
            py: [14, 4, 15, 7, 7],
            pz: [0, 2, 0, 1, -1],
            nx: [0, 0, 1, 1, 1],
            ny: [7, 8, 18, 17, 5],
            nz: [1, 1, 0, 0, 2]
          },
          {
            size: 5,
            px: [12, 12, 9, 5, 3],
            py: [14, 14, 0, 3, 7],
            pz: [0, -1, -1, -1, -1],
            nx: [7, 7, 14, 8, 13],
            ny: [7, 8, 13, 10, 10],
            nz: [1, 1, 0, 1, 0]
          },
          {
            size: 2,
            px: [3, 4],
            py: [7, 9],
            pz: [1, -1],
            nx: [2, 4],
            ny: [5, 4],
            nz: [2, 1]
          },
          {
            size: 3,
            px: [10, 21, 17],
            py: [7, 11, 23],
            pz: [1, 0, 0],
            nx: [21, 9, 3],
            ny: [23, 5, 5],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [8, 11, 9, 10, 11],
            py: [2, 0, 1, 1, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 5, 6, 4, 3],
            ny: [8, 4, 18, 7, 4],
            nz: [1, 1, 0, 1, -1]
          },
          {
            size: 5,
            px: [20, 22, 3, 19, 10],
            py: [20, 9, 4, 22, 3],
            pz: [0, 0, 2, 0, 1],
            nx: [8, 20, 8, 3, 2],
            ny: [4, 3, 6, 4, 3],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 4],
            py: [8, 7],
            pz: [1, 1],
            nx: [9, 2],
            ny: [15, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 13],
            py: [13, 4],
            pz: [0, -1],
            nx: [20, 21],
            ny: [1, 4],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [1, 2, 7, 6, 8],
            py: [0, 2, 3, 3, 3],
            pz: [2, 1, 0, 0, 0],
            nx: [1, 2, 1, 1, 1],
            ny: [0, 0, 4, 3, 3],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [3, 10],
            py: [9, 11],
            pz: [0, 0],
            nx: [6, 3],
            ny: [9, 2],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [12, 12, 12, 12, 6],
            py: [10, 11, 13, 12, 6],
            pz: [0, 0, 0, 0, -1],
            nx: [10, 2, 1, 10, 10],
            ny: [10, 4, 2, 11, 9],
            nz: [0, 1, 2, 0, 0]
          },
          {
            size: 5,
            px: [16, 18, 11, 17, 15],
            py: [11, 12, 8, 12, 11],
            pz: [0, 0, 0, 0, 0],
            nx: [14, 0, 19, 0, 10],
            ny: [9, 3, 14, 8, 9],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 4,
            px: [5, 9, 5, 8],
            py: [21, 18, 20, 23],
            pz: [0, 0, 0, 0],
            nx: [8, 4, 3, 1],
            ny: [20, 3, 4, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [3, 2],
            pz: [2, 2],
            nx: [3, 12],
            ny: [4, 23],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [0, 1, 1, 1, 1],
            py: [2, 16, 14, 13, 12],
            pz: [2, 0, 0, 0, 0],
            nx: [8, 4, 9, 4, 7],
            ny: [9, 3, 4, 2, 9],
            nz: [1, 2, 1, 2, 1]
          },
          {
            size: 2,
            px: [4, 9],
            py: [3, 7],
            pz: [2, -1],
            nx: [4, 9],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [15, 16, 17, 15, 8],
            py: [3, 3, 3, 18, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [1, 2, 2, 1, 3],
            ny: [5, 3, 2, 6, 0],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [4, 17],
            py: [4, 14],
            pz: [2, 0],
            nx: [15, 7],
            ny: [15, 10],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [14, 12, 3],
            py: [3, 13, 3],
            pz: [0, -1, -1],
            nx: [4, 17, 4],
            ny: [3, 19, 4],
            nz: [2, 0, 2]
          },
          {
            size: 4,
            px: [4, 5, 12, 2],
            py: [9, 6, 19, 4],
            pz: [1, 1, 0, 2],
            nx: [12, 17, 4, 4],
            ny: [18, 19, 4, 4],
            nz: [0, -1, -1, -1]
          },
          {
            size: 5,
            px: [10, 19, 20, 20, 19],
            py: [7, 14, 13, 14, 13],
            pz: [1, 0, 0, 0, -1],
            nx: [11, 23, 23, 23, 23],
            ny: [9, 15, 13, 16, 14],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [0, 0, 0, 2],
            py: [5, 6, 5, 14],
            pz: [1, 1, 2, 0],
            nx: [0, 3, 3, 17],
            ny: [23, 5, 5, 9],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [15, 4],
            py: [23, 5],
            pz: [0, 2],
            nx: [9, 3],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [6, 5, 10, 12],
            py: [3, 3, 23, 23],
            pz: [1, 1, 0, 0],
            nx: [11, 1, 1, 4],
            ny: [21, 3, 5, 5],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [9, 4],
            pz: [1, 2],
            nx: [4, 9],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [23, 23, 23, 23, 23],
            py: [14, 9, 13, 11, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [6, 13, 7, 8, 8],
            ny: [9, 6, 3, 3, 3],
            nz: [1, 0, 1, 1, -1]
          },
          {
            size: 2,
            px: [10, 3],
            py: [4, 5],
            pz: [0, -1],
            nx: [3, 8],
            ny: [1, 3],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [3, 12],
            py: [4, 18],
            pz: [2, 0],
            nx: [12, 0],
            ny: [16, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 2],
            py: [4, 4],
            pz: [0, -1],
            nx: [16, 4],
            ny: [1, 0],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [3, 4],
            py: [7, 1],
            pz: [1, -1],
            nx: [5, 3],
            ny: [19, 9],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [20, 19, 20, 21],
            py: [2, 0, 1, 3],
            pz: [0, 0, 0, 0],
            nx: [11, 5, 23, 11],
            ny: [0, 0, 1, 1],
            nz: [1, 2, 0, 1]
          },
          {
            size: 2,
            px: [12, 13],
            py: [7, 5],
            pz: [0, 0],
            nx: [8, 5],
            ny: [3, 5],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [22, 21, 22, 22, 22],
            py: [20, 22, 18, 19, 16],
            pz: [0, 0, 0, 0, 0],
            nx: [2, 3, 3, 15, 15],
            ny: [4, 5, 4, 7, 7],
            nz: [1, 2, 1, 0, -1]
          },
          {
            size: 3,
            px: [15, 14, 14],
            py: [1, 1, 1],
            pz: [0, 0, -1],
            nx: [17, 18, 16],
            ny: [1, 2, 1],
            nz: [0, 0, 0]
          },
          {
            size: 4,
            px: [17, 16, 16, 15],
            py: [2, 1, 0, 0],
            pz: [0, 0, 0, 0],
            nx: [7, 4, 2, 11],
            ny: [11, 2, 1, 4],
            nz: [1, 2, -1, -1]
          },
          {
            size: 4,
            px: [18, 0, 0, 0],
            py: [14, 6, 5, 4],
            pz: [0, -1, -1, -1],
            nx: [19, 19, 19, 19],
            ny: [16, 19, 17, 18],
            nz: [0, 0, 0, 0]
          },
          {
            size: 4,
            px: [11, 5, 5, 0],
            py: [14, 1, 4, 4],
            pz: [0, -1, -1, -1],
            nx: [11, 8, 2, 15],
            ny: [17, 14, 1, 9],
            nz: [0, 0, 2, 0]
          },
          {
            size: 2,
            px: [4, 5],
            py: [19, 21],
            pz: [0, 0],
            nx: [10, 2],
            ny: [15, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 4],
            py: [4, 6],
            pz: [1, 1],
            nx: [3, 3],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 7],
            py: [1, 13],
            pz: [2, 0],
            nx: [7, 2],
            ny: [1, 4],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [15, 10, 4, 7],
            py: [23, 3, 1, 7],
            pz: [0, 1, 2, 1],
            nx: [0, 4, 1, 1],
            ny: [0, 2, 0, -1900147915],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [7, 2],
            py: [12, 11],
            pz: [0, -1],
            nx: [2, 4],
            ny: [2, 5],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [0, 0, 0, 1, 0],
            py: [9, 4, 3, 2, 6],
            pz: [0, 1, 2, 1, 1],
            nx: [9, 4, 2, 16, 16],
            ny: [7, 4, 2, 8, 8],
            nz: [0, 1, 2, 0, -1]
          },
          {
            size: 5,
            px: [18, 4, 9, 4, 4],
            py: [12, 5, 6, 3, 4],
            pz: [0, 2, 1, 2, -1],
            nx: [4, 3, 3, 2, 3],
            ny: [23, 19, 21, 16, 18],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [6, 6],
            py: [14, 13],
            pz: [0, 0],
            nx: [3, 10],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [3, 4, 4, 2, 2],
            py: [8, 11, 7, 4, 4],
            pz: [1, 1, 1, 2, -1],
            nx: [20, 18, 19, 20, 19],
            ny: [4, 0, 2, 3, 1],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [17, 12, 14, 8, 16],
            py: [2, 0, 0, 0, 0],
            pz: [0, 0, 0, 1, 0],
            nx: [3, 15, 3, 2, 2],
            ny: [2, 9, 7, 2, 2],
            nz: [2, 0, 1, 2, -1]
          },
          {
            size: 5,
            px: [11, 10, 11, 11, 11],
            py: [10, 12, 11, 12, 12],
            pz: [0, 0, 0, 0, -1],
            nx: [13, 13, 20, 10, 13],
            ny: [9, 11, 8, 4, 10],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [8, 16],
            py: [7, 13],
            pz: [1, 0],
            nx: [8, 13],
            ny: [4, 11],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 7],
            py: [20, 3],
            pz: [0, -1],
            nx: [3, 4],
            ny: [10, 10],
            nz: [1, 1]
          },
          {
            size: 3,
            px: [13, 10, 17],
            py: [9, 3, 5],
            pz: [0, -1, -1],
            nx: [1, 3, 1],
            ny: [5, 16, 6],
            nz: [2, 0, 1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 5],
            pz: [2, -1],
            nx: [8, 3],
            ny: [14, 10],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [11, 9, 12, 10],
            py: [2, 2, 2, 2],
            pz: [0, 0, 0, 0],
            nx: [4, 4, 4, 10],
            ny: [5, 5, 0, 16],
            nz: [1, -1, -1, -1]
          },
          {
            size: 3,
            px: [7, 9, 12],
            py: [2, 2, 2],
            pz: [1, -1, -1],
            nx: [4, 7, 2],
            ny: [3, 1, 0],
            nz: [0, 0, 2]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 12],
            pz: [2, 0],
            nx: [7, 4],
            ny: [6, 5],
            nz: [1, 2]
          },
          {
            size: 4,
            px: [12, 12, 6, 3],
            py: [12, 11, 21, 7],
            pz: [0, 0, -1, -1],
            nx: [1, 0, 0, 0],
            ny: [13, 3, 6, 5],
            nz: [0, 2, 1, 1]
          },
          {
            size: 3,
            px: [3, 1, 3],
            py: [21, 8, 18],
            pz: [0, 1, 0],
            nx: [11, 20, 0],
            ny: [17, 17, 6],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [2, 8],
            py: [3, 12],
            pz: [2, 0],
            nx: [2, 20],
            ny: [4, 17],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [2, 3, 4, 3, 2],
            py: [10, 14, 14, 15, 13],
            pz: [1, 0, 0, 0, 0],
            nx: [0, 0, 1, 0, 0],
            ny: [21, 20, 23, 19, 19],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [2, 15],
            py: [7, 4],
            pz: [1, -1],
            nx: [3, 8],
            ny: [4, 14],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [19, 14, 12, 15, 4],
            py: [8, 12, 10, 16, 2],
            pz: [0, 0, 0, 0, 2],
            nx: [8, 0, 12, 4, 0],
            ny: [4, 1, 12, 2, 19],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [18, 9],
            py: [15, 3],
            pz: [0, -1],
            nx: [8, 15],
            ny: [9, 14],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [4, 2, 3, 4, 9],
            py: [9, 4, 3, 8, 23],
            pz: [1, 2, 1, 1, 0],
            nx: [11, 23, 23, 11, 11],
            ny: [0, 2, 3, 1, 1],
            nz: [1, 0, 0, 1, -1]
          },
          {
            size: 2,
            px: [6, 7],
            py: [1, 1],
            pz: [0, 0],
            nx: [3, 4],
            ny: [10, 5],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [11, 9, 8, 5],
            py: [12, 15, 13, 3],
            pz: [0, -1, -1, -1],
            nx: [3, 12, 14, 13],
            ny: [0, 3, 3, 3],
            nz: [2, 0, 0, 0]
          },
          {
            size: 2,
            px: [11, 11],
            py: [6, 5],
            pz: [0, 0],
            nx: [8, 11],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [21, 20, 21, 21, 21],
            py: [18, 21, 17, 19, 19],
            pz: [0, 0, 0, 0, -1],
            nx: [2, 5, 4, 4, 5],
            ny: [5, 12, 11, 10, 10],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [1, 1, 1, 1, 1],
            py: [10, 11, 7, 9, 8],
            pz: [0, 0, 0, 0, 0],
            nx: [11, 23, 23, 23, 23],
            ny: [10, 20, 21, 19, 19],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [7, 8, 7, 3, 1],
            py: [14, 13, 13, 2, 2],
            pz: [0, 0, -1, -1, -1],
            nx: [1, 10, 2, 2, 10],
            ny: [2, 13, 4, 16, 12],
            nz: [2, 0, 1, 0, 0]
          },
          {
            size: 2,
            px: [17, 18],
            py: [12, 12],
            pz: [0, 0],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 0],
            py: [5, 20],
            pz: [0, -1],
            nx: [4, 9],
            ny: [0, 2],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [22, 22, 22, 11, 23],
            py: [16, 15, 14, 6, 13],
            pz: [0, 0, 0, 1, 0],
            nx: [16, 15, 7, 9, 9],
            ny: [15, 8, 4, 10, 10],
            nz: [0, 0, 1, 1, -1]
          },
          {
            size: 2,
            px: [13, 3],
            py: [3, 1],
            pz: [0, 2],
            nx: [8, 3],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 6],
            py: [4, 1],
            pz: [1, -1],
            nx: [6, 3],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 3,
            px: [4, 2, 6],
            py: [6, 3, 4],
            pz: [1, 2, 1],
            nx: [10, 0, 4],
            ny: [9, 4, 3],
            nz: [0, -1, -1]
          },
          {
            size: 4,
            px: [2, 8, 4, 10],
            py: [4, 23, 7, 23],
            pz: [2, 0, 1, 0],
            nx: [9, 4, 11, 9],
            ny: [21, 5, 16, 0],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [13, 0],
            pz: [0, -1],
            nx: [8, 2],
            ny: [11, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [3, 3],
            py: [1, 4],
            pz: [1, -1],
            nx: [3, 5],
            ny: [0, 1],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [7, 2],
            py: [0, 0],
            pz: [0, 2],
            nx: [2, 10],
            ny: [1, 6],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [10, 2],
            py: [7, 0],
            pz: [1, -1],
            nx: [21, 5],
            ny: [15, 4],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [1, 1],
            py: [10, 9],
            pz: [0, 0],
            nx: [0, 3],
            ny: [13, 11],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 9],
            py: [13, 0],
            pz: [0, -1],
            nx: [3, 3],
            ny: [4, 3],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [14, 13, 13, 14, 14],
            py: [12, 10, 11, 13, 13],
            pz: [0, 0, 0, 0, -1],
            nx: [9, 8, 4, 5, 7],
            ny: [4, 4, 2, 2, 4],
            nz: [0, 0, 1, 1, 0]
          },
          {
            size: 3,
            px: [2, 4, 1],
            py: [2, 0, 0],
            pz: [0, 0, 1],
            nx: [0, 7, 4],
            ny: [0, 3, 2],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [11, 4],
            py: [5, 0],
            pz: [0, -1],
            nx: [8, 6],
            ny: [4, 9],
            nz: [1, 1]
          },
          {
            size: 3,
            px: [0, 0, 0],
            py: [20, 2, 4],
            pz: [0, -1, -1],
            nx: [12, 3, 10],
            ny: [3, 1, 3],
            nz: [0, 2, 0]
          },
          {
            size: 5,
            px: [5, 11, 10, 13, 13],
            py: [0, 0, 0, 2, 2],
            pz: [1, 0, 0, 0, -1],
            nx: [4, 5, 5, 4, 5],
            ny: [14, 0, 2, 6, 1],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 11],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [14, -1715597992],
            py: [19, 9],
            pz: [0, -1],
            nx: [7, 14],
            ny: [10, 17],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [11, 1],
            py: [9, 0],
            pz: [0, -1],
            nx: [1, 12],
            ny: [2, 10],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [17, 9],
            py: [13, 17],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [0, 7],
            py: [1, 9],
            pz: [1, -1],
            nx: [18, 4],
            ny: [14, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [14, 7],
            py: [23, 9],
            pz: [0, -1],
            nx: [4, 8],
            ny: [5, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [8, 7],
            py: [17, 9],
            pz: [0, -1],
            nx: [3, 2],
            ny: [0, 3],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [13, 4],
            py: [20, 1],
            pz: [0, -1],
            nx: [5, 3],
            ny: [21, 17],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [0, 0, 1],
            py: [3, 6, 15],
            pz: [2, 1, 0],
            nx: [10, 8, 3],
            ny: [6, 4, 2],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [8, 8],
            py: [18, 8],
            pz: [0, -1],
            nx: [5, 4],
            ny: [8, 10],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 5],
            py: [2, 2],
            pz: [1, 1],
            nx: [8, 9],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [11, 5],
            pz: [1, 2],
            nx: [13, 3],
            ny: [19, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 6],
            py: [1, 11],
            pz: [2, -1],
            nx: [3, 2],
            ny: [1, 0],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [9, 4],
            py: [10, 5],
            pz: [1, 2],
            nx: [8, 4],
            ny: [10, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [12, 12],
            py: [11, 20],
            pz: [0, -1],
            nx: [0, 0],
            ny: [6, 10],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [7, 12],
            py: [2, 20],
            pz: [0, -1],
            nx: [2, 2],
            ny: [2, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [0, 15],
            py: [5, 21],
            pz: [1, -1],
            nx: [10, 9],
            ny: [3, 3],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [15, 9],
            py: [1, 0],
            pz: [0, 1],
            nx: [19, 3],
            ny: [0, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [21, 5],
            py: [13, 5],
            pz: [0, 2],
            nx: [23, 6],
            ny: [23, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 8],
            py: [3, 1],
            pz: [2, -1],
            nx: [9, 9],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [7, 7],
            pz: [1, -1],
            nx: [5, 3],
            ny: [23, 17],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [11, 3],
            py: [6, 4],
            pz: [0, -1],
            nx: [2, 4],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 3,
            px: [14, 0, 17],
            py: [20, 3, 21],
            pz: [0, -1, -1],
            nx: [11, 11, 11],
            ny: [7, 9, 10],
            nz: [1, 1, 1]
          },
          {
            size: 5,
            px: [11, 11, 23, 23, 12],
            py: [10, 11, 21, 20, 12],
            pz: [1, 1, 0, 0, 0],
            nx: [8, 3, 6, 7, 7],
            ny: [4, 5, 11, 11, 11],
            nz: [1, 2, 1, 1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [11, 10],
            pz: [0, 0],
            nx: [9, 3],
            ny: [2, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [12, 14],
            py: [19, 19],
            pz: [0, 0],
            nx: [12, 13],
            ny: [18, 17],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [13, 14, 12, 15, 14],
            py: [0, 0, 1, 1, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 8, 4, 7, 7],
            ny: [3, 4, 2, 5, 5],
            nz: [2, 1, 2, 1, -1]
          },
          {
            size: 2,
            px: [17, 5],
            py: [10, 2],
            pz: [0, -1],
            nx: [4, 9],
            ny: [2, 3],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [18, 10],
            py: [6, 10],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [8, 18, 8, 4, 16],
            py: [6, 12, 9, 4, 13],
            pz: [1, 0, 1, 2, 0],
            nx: [3, 4, 3, 5, 5],
            ny: [0, 2, 3, 1, 1],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [2, 4],
            pz: [2, 1],
            nx: [8, 0],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [4, 5],
            pz: [2, -1],
            nx: [4, 2],
            ny: [14, 7],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [3, 4, 4, 3],
            py: [11, 12, 12, 2],
            pz: [0, 0, -1, -1],
            nx: [1, 2, 1, 2],
            ny: [11, 14, 12, 16],
            nz: [0, 0, 0, 0]
          },
          {
            size: 2,
            px: [6, 0],
            py: [11, 0],
            pz: [0, -1],
            nx: [3, 4],
            ny: [4, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [3, 2],
            py: [21, 11],
            pz: [0, 1],
            nx: [3, 2],
            ny: [10, 0],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [10, 3, 13],
            py: [2, 0, 2],
            pz: [0, 2, 0],
            nx: [7, 16, 1],
            ny: [10, 4, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [6, 12],
            py: [2, 5],
            pz: [1, 0],
            nx: [6, 18],
            ny: [1, 19],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 16],
            py: [0, 16],
            pz: [1, -1],
            nx: [11, 2],
            ny: [5, 1],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [11, 10],
            py: [13, 1],
            pz: [0, -1],
            nx: [1, 1],
            ny: [22, 21],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [11, 10],
            py: [18, 18],
            pz: [0, 0],
            nx: [5, 8],
            ny: [9, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 2],
            py: [20, 18],
            pz: [0, 0],
            nx: [8, 3],
            ny: [5, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [14, 2],
            py: [17, 1],
            pz: [0, -1],
            nx: [14, 13],
            ny: [15, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 4],
            py: [2, 3],
            pz: [2, 2],
            nx: [8, 3],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [8, 18, 18, 8, 7],
            py: [6, 11, 11, 7, 9],
            pz: [1, 0, -1, -1, -1],
            nx: [5, 13, 5, 11, 5],
            ny: [3, 11, 0, 8, 2],
            nz: [2, 0, 2, 1, 2]
          },
          {
            size: 5,
            px: [12, 0, 5, 4, 7],
            py: [15, 0, 4, 0, 9],
            pz: [0, -1, -1, -1, -1],
            nx: [8, 7, 4, 16, 6],
            ny: [17, 12, 9, 10, 12],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 2,
            px: [6, 7],
            py: [14, 1],
            pz: [0, -1],
            nx: [5, 4],
            ny: [9, 4],
            nz: [1, 1]
          },
          {
            size: 4,
            px: [8, 0, 22, 4],
            py: [4, 4, 23, 0],
            pz: [0, -1, -1, -1],
            nx: [2, 4, 2, 5],
            ny: [0, 1, 2, 9],
            nz: [2, 1, 2, 1]
          },
          {
            size: 5,
            px: [9, 9, 10, 10, 8],
            py: [0, 1, 1, 2, 0],
            pz: [1, 1, 1, 1, 1],
            nx: [4, 16, 16, 16, 6],
            ny: [2, 11, 11, 11, 12],
            nz: [2, 0, -1, -1, -1]
          },
          {
            size: 2,
            px: [6, 6],
            py: [6, 5],
            pz: [1, 1],
            nx: [0, 4],
            ny: [3, 2],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [10, 3, 4],
            py: [5, 9, 8],
            pz: [1, -1, -1],
            nx: [11, 23, 23],
            ny: [7, 12, 11],
            nz: [1, 0, 0]
          },
          {
            size: 3,
            px: [13, 12, 7],
            py: [19, 19, 10],
            pz: [0, 0, 1],
            nx: [13, 5, 19],
            ny: [20, 15, 22],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [12, 12],
            py: [12, 13],
            pz: [0, 0],
            nx: [9, 10],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 12],
            py: [1, 13],
            pz: [2, -1],
            nx: [2, 7],
            ny: [2, 13],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [10, 10],
            py: [8, 9],
            pz: [1, 1],
            nx: [19, 7],
            ny: [23, 13],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [8, 7, 23, 15],
            py: [11, 12, 4, 21],
            pz: [0, 0, -1, -1],
            nx: [2, 5, 1, 10],
            ny: [6, 6, 2, 13],
            nz: [0, 1, 1, 0]
          },
          {
            size: 2,
            px: [10, 9],
            py: [3, 3],
            pz: [0, 0],
            nx: [2, 3],
            ny: [2, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [3, 4],
            pz: [2, -1],
            nx: [3, 6],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [7, 11],
            py: [20, 16],
            pz: [0, -1],
            nx: [2, 4],
            ny: [5, 20],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [9, 7],
            py: [7, 5],
            pz: [1, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [4, 2],
            py: [11, 3],
            pz: [1, 2],
            nx: [5, 5],
            ny: [3, 5],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [11, 3],
            py: [11, 5],
            pz: [1, -1],
            nx: [4, 1],
            ny: [12, 3],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [9, 11],
            py: [6, 4],
            pz: [1, -1],
            nx: [10, 20],
            ny: [9, 18],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [2, 2, 2, 2, 1],
            py: [15, 13, 16, 14, 7],
            pz: [0, 0, 0, 0, 1],
            nx: [15, 8, 9, 8, 4],
            ny: [11, 6, 5, 5, 4],
            nz: [0, 1, 1, 1, -1]
          },
          {
            size: 2,
            px: [12, 2],
            py: [5, 5],
            pz: [0, -1],
            nx: [3, 2],
            ny: [7, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [5, 11],
            py: [1, 3],
            pz: [2, 1],
            nx: [10, 10],
            ny: [3, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 11],
            py: [13, 18],
            pz: [0, -1],
            nx: [6, 9],
            ny: [9, 4],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [5, 1, 2, 5, 6],
            py: [14, 4, 9, 15, 23],
            pz: [0, 2, 1, 0, 0],
            nx: [4, 9, 18, 16, 17],
            ny: [0, 1, 1, 0, 0],
            nz: [2, 1, 0, 0, 0]
          },
          {
            size: 2,
            px: [16, 17],
            py: [0, 0],
            pz: [0, 0],
            nx: [23, 23],
            ny: [5, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 8],
            py: [20, 6],
            pz: [0, -1],
            nx: [5, 6],
            ny: [12, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [6, 15],
            py: [15, 0],
            pz: [0, -1],
            nx: [6, 3],
            ny: [16, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [18, 20],
            py: [7, 8],
            pz: [0, 0],
            nx: [18, 11],
            ny: [9, 14],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 4],
            py: [12, 6],
            pz: [0, 1],
            nx: [3, 15],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 2],
            pz: [1, 2],
            nx: [5, 5],
            ny: [2, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 20],
            py: [1, 20],
            pz: [1, -1],
            nx: [15, 17],
            ny: [1, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [7, 2],
            py: [16, 4],
            pz: [0, 2],
            nx: [4, 0],
            ny: [10, 6],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 8],
            py: [5, 0],
            pz: [1, -1],
            nx: [1, 1],
            ny: [10, 18],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [22, 0],
            py: [3, 0],
            pz: [0, -1],
            nx: [23, 11],
            ny: [4, 1],
            nz: [0, 1]
          },
          {
            size: 3,
            px: [19, 10, 20],
            py: [21, 8, 18],
            pz: [0, 1, 0],
            nx: [3, 6, 20],
            ny: [5, 11, 14],
            nz: [2, -1, -1]
          },
          {
            size: 4,
            px: [2, 1, 6, 5],
            py: [7, 4, 23, 22],
            pz: [1, 2, 0, 0],
            nx: [9, 19, 20, 4],
            ny: [8, 11, 9, 2],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [2, 11],
            pz: [2, 1],
            nx: [12, 10],
            ny: [21, 9],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [6, 0, 2, 2],
            py: [6, 1, 4, 1],
            pz: [1, -1, -1, -1],
            nx: [0, 0, 0, 0],
            ny: [5, 8, 9, 4],
            nz: [1, 0, 0, 1]
          },
          {
            size: 5,
            px: [3, 13, 6, 11, 9],
            py: [0, 3, 1, 1, 2],
            pz: [2, 0, 1, 0, 0],
            nx: [7, 20, 16, 4, 7],
            ny: [7, 2, 19, 2, 6],
            nz: [1, 0, 0, 2, 1]
          },
          {
            size: 4,
            px: [7, 5, 2, 6],
            py: [7, 7, 4, 11],
            pz: [0, 0, 2, 1],
            nx: [7, 1, 21, 0],
            ny: [8, 4, 11, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [3, 2],
            pz: [2, 2],
            nx: [8, 9],
            ny: [3, 11],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 13],
            py: [3, 5],
            pz: [1, 0],
            nx: [4, 3],
            ny: [2, 2],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [3, 12, 13, 11],
            py: [0, 1, 1, 1],
            pz: [2, 0, 0, 0],
            nx: [8, 9, 13, 0],
            ny: [4, 1, 16, 3],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [10, 1],
            py: [4, 14],
            pz: [0, -1],
            nx: [5, 10],
            ny: [1, 2],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [11, 12],
            py: [21, 21],
            pz: [0, 0],
            nx: [10, 11],
            ny: [19, 19],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 12],
            py: [6, 21],
            pz: [1, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [11, 7],
            py: [19, 0],
            pz: [0, -1],
            nx: [6, 5],
            ny: [9, 11],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [11, 11, 11, 10, 10],
            py: [10, 12, 11, 13, 13],
            pz: [0, 0, 0, 0, -1],
            nx: [7, 13, 6, 12, 7],
            ny: [10, 6, 3, 6, 11],
            nz: [0, 0, 1, 0, 0]
          },
          {
            size: 2,
            px: [12, 11],
            py: [6, 12],
            pz: [0, -1],
            nx: [4, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [16, 15, 16, 15, 17],
            py: [1, 0, 0, 1, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [13, 7, 6, 12, 12],
            ny: [5, 4, 3, 6, 6],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [1, 3],
            pz: [2, 1],
            nx: [1, 5],
            ny: [1, 3],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [13, 6],
            pz: [0, 1],
            nx: [4, 9],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 3],
            py: [4, 3],
            pz: [1, -1],
            nx: [4, 8],
            ny: [3, 6],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [2, 1],
            pz: [0, 1],
            nx: [5, 5],
            ny: [7, 21],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [0, 0],
            pz: [1, -1],
            nx: [19, 17],
            ny: [1, 0],
            nz: [0, 0]
          },
          {
            size: 4,
            px: [8, 11, 5, 0],
            py: [6, 1, 1, 22],
            pz: [1, -1, -1, -1],
            nx: [0, 10, 10, 1],
            ny: [6, 12, 13, 4],
            nz: [1, 0, 0, 1]
          },
          {
            size: 2,
            px: [8, 17],
            py: [6, 13],
            pz: [1, 0],
            nx: [14, 17],
            ny: [9, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 8],
            py: [0, 4],
            pz: [2, -1],
            nx: [9, 8],
            ny: [1, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [11, 14],
            py: [13, 9],
            pz: [0, -1],
            nx: [23, 23],
            ny: [21, 19],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [10, 9],
            py: [9, 3],
            pz: [0, -1],
            nx: [6, 3],
            ny: [2, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [11, 1],
            py: [4, 4],
            pz: [0, -1],
            nx: [2, 4],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [5, 9],
            py: [3, 3],
            pz: [2, -1],
            nx: [17, 9],
            ny: [12, 5],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [9, 7],
            py: [18, 16],
            pz: [0, -1],
            nx: [5, 2],
            ny: [9, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [3, 6],
            py: [0, 1],
            pz: [1, -1],
            nx: [4, 5],
            ny: [1, 0],
            nz: [0, 0]
          }
        ],
        alpha: [
          -1.149973,
          1.149973,
          -6.844773e-1,
          6.844773e-1,
          -6.635048e-1,
          6.635048e-1,
          -4.888349e-1,
          4.888349e-1,
          -4.267976e-1,
          4.267976e-1,
          -4.2581e-1,
          4.2581e-1,
          -4.815853e-1,
          4.815853e-1,
          -4.091859e-1,
          4.091859e-1,
          -3.137414e-1,
          3.137414e-1,
          -3.33986e-1,
          3.33986e-1,
          -3.891196e-1,
          3.891196e-1,
          -4.167691e-1,
          4.167691e-1,
          -3.186609e-1,
          3.186609e-1,
          -2.957171e-1,
          2.957171e-1,
          -3.210062e-1,
          3.210062e-1,
          -2.725684e-1,
          2.725684e-1,
          -2.452176e-1,
          2.452176e-1,
          -2.812662e-1,
          2.812662e-1,
          -3.029622e-1,
          3.029622e-1,
          -3.293745e-1,
          3.293745e-1,
          -3.441536e-1,
          3.441536e-1,
          -2.946918e-1,
          2.946918e-1,
          -2.890545e-1,
          2.890545e-1,
          -1.949205e-1,
          1.949205e-1,
          -2.176102e-1,
          2.176102e-1,
          -2.59519e-1,
          2.59519e-1,
          -2.690931e-1,
          2.690931e-1,
          -2.130294e-1,
          2.130294e-1,
          -2.316308e-1,
          2.316308e-1,
          -2.798562e-1,
          2.798562e-1,
          -2.146988e-1,
          2.146988e-1,
          -2.332089e-1,
          2.332089e-1,
          -2.470614e-1,
          2.470614e-1,
          -2.2043e-1,
          2.2043e-1,
          -2.272045e-1,
          2.272045e-1,
          -2.583686e-1,
          2.583686e-1,
          -2.072299e-1,
          2.072299e-1,
          -1.834971e-1,
          1.834971e-1,
          -2.332656e-1,
          2.332656e-1,
          -3.271297e-1,
          3.271297e-1,
          -2.401937e-1,
          2.401937e-1,
          -2.006316e-1,
          2.006316e-1,
          -2.401947e-1,
          2.401947e-1,
          -2.475346e-1,
          2.475346e-1,
          -2.579532e-1,
          2.579532e-1,
          -2.466235e-1,
          2.466235e-1,
          -1.787582e-1,
          1.787582e-1,
          -2.036892e-1,
          2.036892e-1,
          -1.665028e-1,
          1.665028e-1,
          -1.57651e-1,
          1.57651e-1,
          -2.036997e-1,
          2.036997e-1,
          -2.040734e-1,
          2.040734e-1,
          -1.792532e-1,
          1.792532e-1,
          -2.174767e-1,
          2.174767e-1,
          -1.876948e-1,
          1.876948e-1,
          -1.883137e-1,
          1.883137e-1,
          -1.923872e-1,
          1.923872e-1,
          -2.620218e-1,
          2.620218e-1,
          -1.659873e-1,
          1.659873e-1,
          -1.475948e-1,
          1.475948e-1,
          -1.731607e-1,
          1.731607e-1,
          -2.059256e-1,
          2.059256e-1,
          -1.586309e-1,
          1.586309e-1,
          -1.607668e-1,
          1.607668e-1,
          -1.975101e-1,
          1.975101e-1,
          -2.130745e-1,
          2.130745e-1,
          -1.898872e-1,
          1.898872e-1,
          -2.052598e-1,
          2.052598e-1,
          -1.599397e-1,
          1.599397e-1,
          -1.770134e-1,
          1.770134e-1,
          -1.888249e-1,
          1.888249e-1,
          -1.515406e-1,
          1.515406e-1,
          -1.907771e-1,
          1.907771e-1,
          -1.698406e-1,
          1.698406e-1,
          -2.079535e-1,
          2.079535e-1,
          -1.966967e-1,
          1.966967e-1,
          -1.631391e-1,
          1.631391e-1,
          -2.158666e-1,
          2.158666e-1,
          -2.891774e-1,
          2.891774e-1,
          -1.581556e-1,
          1.581556e-1,
          -1.475359e-1,
          1.475359e-1,
          -1.806169e-1,
          1.806169e-1,
          -1.782238e-1,
          1.782238e-1,
          -1.66044e-1,
          1.66044e-1,
          -1.576919e-1,
          1.576919e-1,
          -1.741775e-1,
          1.741775e-1,
          -1.427265e-1,
          1.427265e-1,
          -1.69588e-1,
          1.69588e-1,
          -1.486712e-1,
          1.486712e-1,
          -1.533565e-1,
          1.533565e-1,
          -1.601464e-1,
          1.601464e-1,
          -1.978414e-1,
          1.978414e-1,
          -1.746566e-1,
          1.746566e-1,
          -1.794736e-1,
          1.794736e-1,
          -1.896567e-1,
          1.896567e-1,
          -1.666197e-1,
          1.666197e-1,
          -1.969351e-1,
          1.969351e-1,
          -2.321735e-1,
          2.321735e-1,
          -1.592485e-1,
          1.592485e-1,
          -1.671464e-1,
          1.671464e-1,
          -1.688885e-1,
          1.688885e-1,
          -1.868042e-1,
          1.868042e-1,
          -1.301138e-1,
          1.301138e-1,
          -1.330094e-1,
          1.330094e-1,
          -1.268423e-1,
          1.268423e-1,
          -1.820868e-1,
          1.820868e-1,
          -1.88102e-1,
          1.88102e-1,
          -1.580814e-1,
          1.580814e-1,
          -1.302653e-1,
          1.302653e-1,
          -1.787262e-1,
          1.787262e-1,
          -1.658453e-1,
          1.658453e-1,
          -1.240772e-1,
          1.240772e-1,
          -1.315621e-1,
          1.315621e-1,
          -1.756341e-1,
          1.756341e-1,
          -1.429438e-1,
          1.429438e-1,
          -1.351775e-1,
          1.351775e-1,
          -2.035692e-1,
          2.035692e-1,
          -1.26767e-1,
          1.26767e-1,
          -1.28847e-1,
          1.28847e-1,
          -1.393648e-1,
          1.393648e-1,
          -1.755962e-1,
          1.755962e-1,
          -1.308445e-1,
          1.308445e-1,
          -1.703894e-1,
          1.703894e-1,
          -1.461334e-1,
          1.461334e-1,
          -1.368683e-1,
          1.368683e-1,
          -1.244085e-1,
          1.244085e-1,
          -1.718163e-1,
          1.718163e-1,
          -1.415624e-1,
          1.415624e-1,
          -1.752024e-1,
          1.752024e-1,
          -1.666463e-1,
          1.666463e-1,
          -1.407325e-1,
          1.407325e-1,
          -1.258317e-1,
          1.258317e-1,
          -1.416511e-1,
          1.416511e-1,
          -1.420816e-1,
          1.420816e-1,
          -1.562547e-1,
          1.562547e-1,
          -1.542952e-1,
          1.542952e-1,
          -1.158829e-1,
          1.158829e-1,
          -1.392875e-1,
          1.392875e-1,
          -1.610095e-1,
          1.610095e-1,
          -1.54644e-1,
          1.54644e-1,
          -1.416235e-1,
          1.416235e-1,
          -2.028817e-1,
          2.028817e-1,
          -1.106779e-1,
          1.106779e-1,
          -9.23166e-2,
          9.23166e-2,
          -1.16446e-1,
          1.16446e-1,
          -1.701578e-1,
          1.701578e-1,
          -1.277995e-1,
          1.277995e-1,
          -1.946177e-1,
          1.946177e-1,
          -1.394509e-1,
          1.394509e-1,
          -1.370145e-1,
          1.370145e-1,
          -1.446031e-1,
          1.446031e-1,
          -1.665215e-1,
          1.665215e-1,
          -1.435822e-1,
          1.435822e-1,
          -1.559354e-1,
          1.559354e-1,
          -1.59186e-1,
          1.59186e-1,
          -1.193338e-1,
          1.193338e-1,
          -1.236954e-1,
          1.236954e-1,
          -1.209139e-1,
          1.209139e-1,
          -1.267385e-1,
          1.267385e-1,
          -1.232397e-1,
          1.232397e-1,
          -1.299632e-1,
          1.299632e-1,
          -1.30202e-1,
          1.30202e-1,
          -1.202975e-1,
          1.202975e-1,
          -1.525378e-1,
          1.525378e-1,
          -1.123073e-1,
          1.123073e-1,
          -1.605678e-1,
          1.605678e-1,
          -1.406867e-1,
          1.406867e-1,
          -1.354273e-1,
          1.354273e-1,
          -1.393192e-1,
          1.393192e-1,
          -1.278263e-1,
          1.278263e-1,
          -1.172073e-1,
          1.172073e-1,
          -1.153493e-1,
          1.153493e-1,
          -1.356318e-1,
          1.356318e-1,
          -1.316614e-1,
          1.316614e-1,
          -1.374489e-1,
          1.374489e-1,
          -1.018254e-1,
          1.018254e-1,
          -1.473336e-1,
          1.473336e-1,
          -1.289687e-1,
          1.289687e-1,
          -1.299183e-1,
          1.299183e-1,
          -1.178391e-1,
          1.178391e-1,
          -1.619059e-1,
          1.619059e-1,
          -1.842569e-1,
          1.842569e-1,
          -1.829095e-1,
          1.829095e-1,
          -1.939918e-1,
          1.939918e-1,
          -1.395362e-1,
          1.395362e-1,
          -1.774673e-1,
          1.774673e-1,
          -1.688216e-1,
          1.688216e-1,
          -1.671747e-1,
          1.671747e-1,
          -1.850178e-1,
          1.850178e-1,
          -1.106695e-1,
          1.106695e-1,
          -1.258323e-1,
          1.258323e-1,
          -1.246819e-1,
          1.246819e-1,
          -9.892193e-2,
          9.892193e-2,
          -1.399638e-1,
          1.399638e-1,
          -1.228375e-1,
          1.228375e-1,
          -1.756236e-1,
          1.756236e-1,
          -1.360307e-1,
          1.360307e-1,
          -1.266574e-1,
          1.266574e-1,
          -1.372135e-1,
          1.372135e-1,
          -1.175947e-1,
          1.175947e-1,
          -1.330075e-1,
          1.330075e-1,
          -1.396152e-1,
          1.396152e-1,
          -2.088443e-1,
          2.088443e-1
        ]
      },
      {
        count: 301,
        threshold: -4.887516,
        feature: [
          {
            size: 5,
            px: [8, 11, 8, 14, 10],
            py: [6, 9, 3, 3, 4],
            pz: [1, 0, 0, 0, 0],
            nx: [8, 7, 19, 7, 13],
            ny: [11, 8, 8, 5, 8],
            nz: [1, 1, 0, 1, 0]
          },
          {
            size: 5,
            px: [14, 3, 13, 12, 12],
            py: [4, 6, 4, 4, 8],
            pz: [0, 1, 0, 0, 0],
            nx: [2, 5, 2, 10, 10],
            ny: [2, 8, 5, 8, 8],
            nz: [2, 1, 2, 0, -1]
          },
          {
            size: 5,
            px: [6, 5, 3, 7, 7],
            py: [2, 3, 1, 2, 2],
            pz: [0, 0, 1, 0, -1],
            nx: [2, 2, 1, 2, 1],
            ny: [3, 1, 2, 2, 2],
            nz: [0, 0, 2, 0, 1]
          },
          {
            size: 5,
            px: [3, 3, 6, 12, 8],
            py: [4, 2, 4, 10, 17],
            pz: [2, 2, 1, 0, 0],
            nx: [4, 8, 8, 2, 1],
            ny: [4, 4, 4, 2, 2],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 5,
            px: [18, 19, 17, 9, 16],
            py: [1, 2, 2, 0, 2],
            pz: [0, 0, 0, 1, 0],
            nx: [23, 23, 22, 22, 22],
            ny: [4, 3, 1, 0, 2],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 3,
            px: [15, 4, 14],
            py: [23, 4, 18],
            pz: [0, 2, 0],
            nx: [7, 0, 5],
            ny: [10, 4, 9],
            nz: [1, -1, -1]
          },
          {
            size: 5,
            px: [11, 11, 16, 11, 17],
            py: [8, 6, 11, 7, 11],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 4, 14, 14, 1],
            ny: [4, 4, 8, 8, 5],
            nz: [1, 1, 0, -1, -1]
          },
          {
            size: 5,
            px: [12, 12, 12, 12, 12],
            py: [13, 10, 11, 12, 12],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 4, 1, 2, 9],
            ny: [8, 10, 2, 4, 15],
            nz: [0, 1, 2, 1, 0]
          },
          {
            size: 2,
            px: [19, 0],
            py: [14, 17],
            pz: [0, -1],
            nx: [20, 19],
            ny: [15, 22],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [3, 3, 1, 3, 5],
            py: [13, 15, 6, 14, 22],
            pz: [0, 0, 1, 0, 0],
            nx: [0, 0, 1, 0, 0],
            ny: [11, 21, 23, 5, 5],
            nz: [1, 0, 0, 2, -1]
          },
          {
            size: 5,
            px: [4, 2, 10, 4, 3],
            py: [19, 4, 13, 16, 13],
            pz: [0, 1, 0, 0, 0],
            nx: [3, 20, 7, 4, 0],
            ny: [4, 19, 5, 1, 5],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [4, 4],
            pz: [0, -1],
            nx: [15, 3],
            ny: [15, 1],
            nz: [0, 2]
          },
          {
            size: 4,
            px: [17, 17, 12, 11],
            py: [14, 15, 18, 18],
            pz: [0, 0, 0, 0],
            nx: [11, 4, 1, 0],
            ny: [17, 20, 8, 5],
            nz: [0, -1, -1, -1]
          },
          {
            size: 5,
            px: [6, 2, 1, 2, 11],
            py: [14, 4, 1, 1, 18],
            pz: [0, -1, -1, -1, -1],
            nx: [5, 5, 3, 5, 2],
            ny: [18, 17, 7, 9, 2],
            nz: [0, 0, 1, 1, 2]
          },
          {
            size: 5,
            px: [20, 19, 20, 15, 20],
            py: [17, 20, 12, 12, 8],
            pz: [0, 0, 0, 0, 0],
            nx: [17, 0, 5, 2, 2],
            ny: [8, 4, 9, 2, 2],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [6, 8],
            py: [7, 11],
            pz: [1, -1],
            nx: [7, 8],
            ny: [7, 10],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [15, 16, 14, 8, 8],
            py: [2, 2, 2, 0, 0],
            pz: [0, 0, 0, 1, -1],
            nx: [20, 11, 21, 18, 19],
            ny: [3, 6, 5, 1, 2],
            nz: [0, 1, 0, 0, 0]
          },
          {
            size: 4,
            px: [17, 18, 9, 8],
            py: [23, 21, 7, 8],
            pz: [0, 0, 1, 1],
            nx: [8, 17, 10, 18],
            ny: [4, 12, 2, 1],
            nz: [1, -1, -1, -1]
          },
          {
            size: 5,
            px: [2, 2, 9, 4, 8],
            py: [7, 3, 12, 12, 23],
            pz: [1, 1, 0, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [3, 1, 2, 4, 4],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 3,
            px: [7, 8, 5],
            py: [22, 23, 9],
            pz: [0, 0, 1],
            nx: [9, 4, 2],
            ny: [21, 4, 0],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [7, 7],
            pz: [1, -1],
            nx: [3, 2],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [15, 11, 10, 3, 17],
            py: [0, 1, 2, 3, 1],
            pz: [0, 0, 0, 2, 0],
            nx: [5, 8, 4, 3, 3],
            ny: [9, 4, 7, 10, 10],
            nz: [1, 1, 1, 1, -1]
          },
          {
            size: 3,
            px: [22, 11, 22],
            py: [12, 5, 14],
            pz: [0, 1, 0],
            nx: [23, 23, 3],
            ny: [22, 23, 8],
            nz: [0, 0, -1]
          },
          {
            size: 2,
            px: [3, 11],
            py: [7, 5],
            pz: [1, -1],
            nx: [8, 2],
            ny: [14, 5],
            nz: [0, 2]
          },
          {
            size: 4,
            px: [17, 16, 2, 4],
            py: [14, 13, 5, 0],
            pz: [0, 0, -1, -1],
            nx: [8, 9, 15, 8],
            ny: [8, 9, 14, 7],
            nz: [1, 1, 0, 1]
          },
          {
            size: 2,
            px: [5, 16],
            py: [6, 13],
            pz: [1, -1],
            nx: [2, 1],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [1, 0, 1, 2, 1],
            py: [15, 2, 16, 19, 12],
            pz: [0, 2, 0, 0, 0],
            nx: [8, 7, 4, 9, 9],
            ny: [5, 11, 4, 5, 5],
            nz: [1, 1, 1, 1, -1]
          },
          {
            size: 2,
            px: [8, 7],
            py: [11, 12],
            pz: [0, 0],
            nx: [9, 1],
            ny: [10, 16],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [15, 13],
            py: [17, 10],
            pz: [0, -1],
            nx: [7, 4],
            ny: [8, 4],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [11, 10, 7, 8, 9],
            py: [0, 0, 1, 1, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 5, 4, 5, 6],
            ny: [1, 0, 2, 1, 0],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [4, 3],
            pz: [2, 2],
            nx: [3, 21],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [10, 11, 5, 2, 11],
            py: [12, 10, 6, 11, 11],
            pz: [0, 0, 1, 0, 0],
            nx: [4, 15, 16, 7, 7],
            ny: [5, 10, 11, 10, 10],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [13, 14, 1, 11, 11],
            py: [2, 2, 3, 2, 2],
            pz: [0, 0, 2, 0, -1],
            nx: [3, 0, 0, 1, 0],
            ny: [23, 15, 14, 9, 8],
            nz: [0, 0, 0, 1, 1]
          },
          {
            size: 2,
            px: [17, 2],
            py: [13, 5],
            pz: [0, -1],
            nx: [4, 9],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [4, 1],
            pz: [0, -1],
            nx: [11, 3],
            ny: [3, 0],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [5, 3],
            py: [3, 3],
            pz: [2, -1],
            nx: [11, 23],
            ny: [8, 14],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [22, 22, 22],
            py: [16, 18, 9],
            pz: [0, 0, 0],
            nx: [13, 2, 0],
            ny: [17, 3, 5],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [13, 10, 13, 14, 11],
            py: [2, 2, 1, 2, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [3, 3, 8, 6, 6],
            ny: [2, 5, 4, 11, 11],
            nz: [2, 2, 1, 1, -1]
          },
          {
            size: 3,
            px: [12, 1, 1],
            py: [14, 0, 1],
            pz: [0, -1, -1],
            nx: [8, 15, 7],
            ny: [1, 2, 0],
            nz: [1, 0, 1]
          },
          {
            size: 2,
            px: [4, 5],
            py: [20, 23],
            pz: [0, 0],
            nx: [3, 3],
            ny: [10, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [7, 2],
            pz: [1, -1],
            nx: [4, 3],
            ny: [23, 16],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [3, 3, 6],
            py: [5, 2, 4],
            pz: [2, 2, 1],
            nx: [3, 1, 2],
            ny: [5, 17, 0],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [14, 8],
            py: [17, 6],
            pz: [0, 1],
            nx: [13, 10],
            ny: [16, 9],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [15, 7, 14, 13, 14],
            py: [1, 0, 0, 0, 1],
            pz: [0, 1, 0, 0, 0],
            nx: [4, 4, 4, 8, 8],
            ny: [5, 3, 2, 10, 10],
            nz: [2, 2, 2, 1, -1]
          },
          {
            size: 5,
            px: [8, 9, 4, 5, 4],
            py: [13, 12, 9, 5, 7],
            pz: [0, 0, 1, 1, 1],
            nx: [22, 21, 22, 22, 22],
            ny: [4, 0, 3, 2, 2],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [17, 17],
            py: [16, 13],
            pz: [0, 0],
            nx: [14, 21],
            ny: [8, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 10],
            py: [4, 9],
            pz: [0, -1],
            nx: [16, 10],
            ny: [3, 3],
            nz: [0, 1]
          },
          {
            size: 5,
            px: [1, 1, 0, 1, 0],
            py: [17, 16, 7, 15, 8],
            pz: [0, 0, 1, 0, 0],
            nx: [4, 3, 8, 9, 7],
            ny: [3, 3, 6, 6, 6],
            nz: [1, 1, 0, 0, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [2, 3],
            pz: [2, 2],
            nx: [8, 3],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 2],
            py: [17, 4],
            pz: [0, 2],
            nx: [10, 12],
            ny: [15, 14],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [14, 12],
            pz: [0, 0],
            nx: [9, 10],
            ny: [13, 11],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 13],
            py: [5, 5],
            pz: [0, 0],
            nx: [3, 4],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [7, 10, 8, 11, 11],
            py: [13, 2, 12, 2, 2],
            pz: [0, 0, 0, 0, -1],
            nx: [10, 1, 1, 10, 1],
            ny: [12, 5, 3, 13, 1],
            nz: [0, 1, 1, 0, 2]
          },
          {
            size: 2,
            px: [6, 10],
            py: [4, 2],
            pz: [1, -1],
            nx: [4, 6],
            ny: [4, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [20, 20],
            py: [21, 22],
            pz: [0, 0],
            nx: [15, 8],
            ny: [5, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [3, 3],
            pz: [2, 2],
            nx: [9, 17],
            ny: [4, 15],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [2, 2, 4],
            py: [3, 3, 7],
            pz: [2, -1, -1],
            nx: [7, 4, 4],
            ny: [6, 5, 4],
            nz: [1, 2, 2]
          },
          {
            size: 5,
            px: [8, 9, 16, 17, 17],
            py: [1, 2, 1, 1, 1],
            pz: [1, 1, 0, 0, -1],
            nx: [2, 2, 4, 2, 4],
            ny: [16, 14, 22, 15, 21],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [9, 9],
            py: [18, 0],
            pz: [0, -1],
            nx: [2, 5],
            ny: [5, 8],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [7, 8],
            py: [11, 11],
            pz: [0, 0],
            nx: [15, 5],
            ny: [8, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 3],
            py: [4, 3],
            pz: [2, -1],
            nx: [1, 6],
            ny: [4, 14],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [6, 12],
            py: [7, 11],
            pz: [1, -1],
            nx: [0, 0],
            ny: [7, 12],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [3, 7],
            py: [10, 22],
            pz: [1, 0],
            nx: [4, 3],
            ny: [10, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 19],
            py: [4, 21],
            pz: [2, -1],
            nx: [11, 11],
            ny: [8, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [8, 7],
            pz: [1, 1],
            nx: [4, 20],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [11, 23, 23, 23, 23],
            py: [7, 13, 19, 20, 21],
            pz: [1, 0, 0, 0, 0],
            nx: [4, 3, 2, 8, 8],
            ny: [11, 5, 5, 23, 23],
            nz: [1, 1, 2, 0, -1]
          },
          {
            size: 2,
            px: [4, 1],
            py: [0, 2],
            pz: [0, 0],
            nx: [0, 6],
            ny: [0, 11],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 8],
            py: [12, 1],
            pz: [0, -1],
            nx: [23, 23],
            ny: [13, 12],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [23, 11, 23, 11, 11],
            py: [13, 7, 12, 5, 6],
            pz: [0, 1, 0, 1, 1],
            nx: [6, 3, 8, 7, 7],
            ny: [12, 4, 4, 11, 11],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 2,
            px: [20, 5],
            py: [15, 5],
            pz: [0, -1],
            nx: [10, 10],
            ny: [11, 10],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [11, 4],
            py: [19, 8],
            pz: [0, 1],
            nx: [11, 19],
            ny: [18, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [14, 6],
            py: [3, 4],
            pz: [0, -1],
            nx: [8, 15],
            ny: [1, 0],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [14, 5, 13, 12],
            py: [23, 3, 23, 23],
            pz: [0, 1, 0, 0],
            nx: [12, 0, 1, 4],
            ny: [21, 3, 2, 4],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [19, 5],
            py: [12, 2],
            pz: [0, -1],
            nx: [4, 7],
            ny: [3, 5],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [0, 8],
            py: [5, 3],
            pz: [2, -1],
            nx: [5, 22],
            ny: [3, 11],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [2, 6],
            py: [3, 12],
            pz: [2, 0],
            nx: [3, 5],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [0, 6],
            pz: [2, -1],
            nx: [14, 6],
            ny: [4, 2],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [16, 11],
            py: [1, 0],
            pz: [0, -1],
            nx: [4, 8],
            ny: [4, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [9, 4],
            py: [4, 3],
            pz: [1, 1],
            nx: [5, 8],
            ny: [0, 10],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [16, 1],
            py: [22, 1],
            pz: [0, -1],
            nx: [2, 2],
            ny: [4, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [12, 2],
            py: [11, 2],
            pz: [0, -1],
            nx: [5, 5],
            ny: [1, 0],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [11, 11],
            py: [4, 3],
            pz: [1, 1],
            nx: [7, 5],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 2],
            py: [22, 3],
            pz: [0, 2],
            nx: [4, 9],
            ny: [10, 11],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [8, 10],
            pz: [1, -1],
            nx: [5, 3],
            ny: [23, 18],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 6],
            py: [21, 9],
            pz: [0, -1],
            nx: [11, 23],
            ny: [6, 10],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [9, 9],
            py: [8, 7],
            pz: [1, 1],
            nx: [18, 8],
            ny: [18, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 3],
            py: [19, 0],
            pz: [0, -1],
            nx: [6, 5],
            ny: [9, 11],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [2, 10, 9, 7, 8],
            py: [0, 1, 0, 1, 0],
            pz: [2, 0, 0, 0, 0],
            nx: [3, 4, 6, 8, 8],
            ny: [2, 4, 9, 4, 4],
            nz: [2, 1, 1, 1, -1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [9, 4],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 4],
            py: [23, 3],
            pz: [0, -1],
            nx: [12, 9],
            ny: [2, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 2],
            py: [10, 3],
            pz: [1, 2],
            nx: [0, 2],
            ny: [23, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 14],
            py: [18, 0],
            pz: [0, -1],
            nx: [12, 8],
            ny: [16, 10],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [10, 18, 7, 5],
            py: [14, 8, 0, 3],
            pz: [0, -1, -1, -1],
            nx: [8, 6, 8, 5],
            ny: [11, 12, 5, 5],
            nz: [0, 0, 1, 1]
          },
          {
            size: 2,
            px: [6, 5],
            py: [2, 2],
            pz: [1, 1],
            nx: [8, 8],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [12, 10],
            py: [20, 20],
            pz: [0, 0],
            nx: [11, 10],
            ny: [19, 19],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [17, 10],
            py: [16, 20],
            pz: [0, -1],
            nx: [8, 7],
            ny: [4, 8],
            nz: [1, 1]
          },
          {
            size: 3,
            px: [2, 1, 3],
            py: [20, 4, 21],
            pz: [0, 2, 0],
            nx: [3, 4, 0],
            ny: [10, 1, 0],
            nz: [1, -1, -1]
          },
          {
            size: 5,
            px: [6, 7, 3, 6, 6],
            py: [15, 14, 7, 16, 19],
            pz: [0, 0, 1, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [18, 19, 16, 17, 17],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [8, 16],
            py: [6, 12],
            pz: [1, 0],
            nx: [8, 15],
            ny: [4, 10],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [1, 3, 2, 0, 4],
            pz: [2, 2, 2, 2, 1],
            nx: [13, 8, 14, 4, 7],
            ny: [23, 6, 23, 3, 9],
            nz: [0, 1, 0, 2, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [3, 5],
            pz: [2, 1],
            nx: [10, 8],
            ny: [11, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 10],
            py: [4, 4],
            pz: [0, 0],
            nx: [8, 5],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [15, 18, 9, 16, 4],
            py: [12, 13, 6, 23, 3],
            pz: [0, 0, 1, 0, 2],
            nx: [6, 3, 6, 2, 7],
            ny: [2, 3, 0, 1, 0],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [4, 18],
            py: [12, 13],
            pz: [0, -1],
            nx: [2, 8],
            ny: [3, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [10, 4],
            pz: [1, 2],
            nx: [3, 3],
            ny: [5, 0],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [9, 19],
            py: [7, 8],
            pz: [1, 0],
            nx: [8, 3],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 0],
            py: [6, 0],
            pz: [0, -1],
            nx: [0, 0],
            ny: [7, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [8, 8],
            py: [0, 0],
            pz: [1, -1],
            nx: [17, 18],
            ny: [0, 2],
            nz: [0, 0]
          },
          {
            size: 4,
            px: [13, 4, 4, 1],
            py: [14, 7, 3, 5],
            pz: [0, -1, -1, -1],
            nx: [3, 16, 3, 7],
            ny: [1, 15, 5, 13],
            nz: [2, 0, 2, 0]
          },
          {
            size: 2,
            px: [4, 9],
            py: [6, 11],
            pz: [1, 0],
            nx: [3, 23],
            ny: [4, 8],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [9, 17, 4, 16, 16],
            py: [2, 3, 1, 3, 3],
            pz: [1, 0, 2, 0, -1],
            nx: [2, 3, 3, 2, 3],
            ny: [1, 7, 2, 3, 3],
            nz: [2, 1, 1, 1, 1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [22, 9],
            pz: [0, 1],
            nx: [10, 3],
            ny: [21, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [6, 3],
            pz: [0, -1],
            nx: [8, 5],
            ny: [4, 3],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [8, 3],
            pz: [0, -1],
            nx: [14, 5],
            ny: [14, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [7, 8],
            py: [3, 2],
            pz: [0, -1],
            nx: [8, 2],
            ny: [18, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [1, 1],
            py: [19, 11],
            pz: [0, 1],
            nx: [9, 4],
            ny: [5, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 3],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [7, 15, 13, 14, 4],
            py: [6, 12, 9, 11, 4],
            pz: [1, 0, 0, 0, 2],
            nx: [7, 3, 8, 4, 5],
            ny: [0, 3, 0, 2, 1],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [10, 13, 7, 8, 9],
            py: [0, 1, 1, 0, 1],
            pz: [0, 0, 0, 0, 0],
            nx: [7, 4, 4, 4, 8],
            ny: [8, 3, 4, 2, 4],
            nz: [1, 2, 2, 2, 1]
          },
          {
            size: 2,
            px: [6, 1],
            py: [6, 0],
            pz: [1, -1],
            nx: [11, 7],
            ny: [3, 2],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [13, 0],
            py: [13, 2],
            pz: [0, -1],
            nx: [0, 1],
            ny: [13, 16],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 17],
            py: [6, 13],
            pz: [1, 0],
            nx: [8, 1],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [12, 11, 3, 6, 17],
            py: [4, 4, 1, 2, 14],
            pz: [0, 0, 2, 1, 0],
            nx: [6, 23, 23, 6, 23],
            ny: [5, 7, 6, 6, 14],
            nz: [1, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [5, 22],
            py: [4, 17],
            pz: [2, -1],
            nx: [4, 8],
            ny: [5, 7],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [15, 14],
            py: [1, 1],
            pz: [0, 0],
            nx: [4, 7],
            ny: [2, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [15, 17],
            py: [12, 7],
            pz: [0, -1],
            nx: [14, 10],
            ny: [11, 4],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [10, 2, 9, 15],
            py: [5, 11, 1, 13],
            pz: [0, -1, -1, -1],
            nx: [11, 3, 3, 13],
            ny: [1, 1, 0, 1],
            nz: [0, 2, 2, 0]
          },
          {
            size: 2,
            px: [7, 21],
            py: [15, 22],
            pz: [0, -1],
            nx: [4, 9],
            ny: [8, 14],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [6, 5],
            py: [21, 2],
            pz: [0, -1],
            nx: [3, 5],
            ny: [11, 21],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [17, 7],
            py: [2, 0],
            pz: [0, -1],
            nx: [4, 8],
            ny: [5, 11],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [11, 8],
            py: [10, 4],
            pz: [0, -1],
            nx: [13, 12],
            ny: [3, 3],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [6, 5],
            py: [2, 2],
            pz: [1, 1],
            nx: [7, 1],
            ny: [8, 2],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [0, 0, 1, 0, 0],
            py: [12, 4, 14, 0, 2],
            pz: [0, 1, 0, 2, 2],
            nx: [9, 5, 8, 4, 4],
            ny: [6, 3, 6, 3, 3],
            nz: [0, 1, 0, 1, -1]
          },
          {
            size: 5,
            px: [8, 0, 0, 3, 2],
            py: [6, 5, 0, 8, 2],
            pz: [1, -1, -1, -1, -1],
            nx: [23, 7, 22, 11, 4],
            ny: [12, 6, 14, 4, 3],
            nz: [0, 1, 0, 1, 2]
          },
          {
            size: 4,
            px: [12, 12, 4, 8],
            py: [12, 11, 3, 10],
            pz: [0, 0, -1, -1],
            nx: [0, 0, 0, 0],
            ny: [2, 1, 0, 3],
            nz: [1, 2, 2, 1]
          },
          {
            size: 2,
            px: [10, 6],
            py: [7, 6],
            pz: [1, -1],
            nx: [16, 4],
            ny: [12, 2],
            nz: [0, 2]
          },
          {
            size: 5,
            px: [2, 1, 3, 3, 3],
            py: [14, 8, 20, 21, 21],
            pz: [0, 1, 0, 0, -1],
            nx: [20, 10, 21, 21, 21],
            ny: [23, 11, 21, 23, 20],
            nz: [0, 1, 0, 0, 0]
          },
          {
            size: 2,
            px: [6, 13],
            py: [2, 4],
            pz: [1, 0],
            nx: [7, 21],
            ny: [8, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 3],
            py: [17, 4],
            pz: [0, 2],
            nx: [11, 10],
            ny: [15, 7],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [11, 0, 19, 2],
            py: [15, 2, 23, 10],
            pz: [0, -1, -1, -1],
            nx: [6, 8, 16, 2],
            ny: [13, 11, 10, 2],
            nz: [0, 0, 0, 2]
          },
          {
            size: 2,
            px: [6, 3],
            py: [14, 7],
            pz: [0, 1],
            nx: [3, 1],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [12, 17, 5, 10],
            py: [19, 15, 14, 3],
            pz: [0, -1, -1, -1],
            nx: [4, 12, 6, 12],
            ny: [4, 18, 9, 22],
            nz: [1, 0, 1, 0]
          },
          {
            size: 2,
            px: [8, 3],
            py: [13, 5],
            pz: [0, -1],
            nx: [3, 4],
            ny: [4, 9],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [6, 5, 4, 5, 3],
            py: [2, 1, 2, 2, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [7, 4, 9, 18, 18],
            ny: [4, 4, 7, 14, 14],
            nz: [1, 1, 1, 0, -1]
          },
          {
            size: 4,
            px: [8, 3, 20, 1],
            py: [6, 3, 18, 0],
            pz: [1, -1, -1, -1],
            nx: [13, 11, 5, 22],
            ny: [12, 6, 2, 17],
            nz: [0, 1, 2, 0]
          },
          {
            size: 2,
            px: [6, 3],
            py: [6, 3],
            pz: [1, 2],
            nx: [8, 5],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [21, 7],
            py: [14, 7],
            pz: [0, 1],
            nx: [16, 11],
            ny: [14, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [3, 1],
            pz: [0, -1],
            nx: [9, 5],
            ny: [0, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [4, 10],
            py: [5, 8],
            pz: [2, 1],
            nx: [5, 14],
            ny: [9, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 2],
            py: [23, 4],
            pz: [0, 2],
            nx: [2, 2],
            ny: [5, 5],
            nz: [2, -1]
          },
          {
            size: 5,
            px: [10, 9, 11, 10, 10],
            py: [2, 2, 1, 1, 1],
            pz: [0, 0, 0, 0, -1],
            nx: [2, 3, 2, 4, 5],
            ny: [4, 10, 2, 4, 3],
            nz: [2, 1, 1, 0, 0]
          },
          {
            size: 2,
            px: [11, 4],
            py: [13, 4],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [17, 5],
            py: [15, 1],
            pz: [0, -1],
            nx: [20, 19],
            ny: [14, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 2],
            py: [20, 18],
            pz: [0, 0],
            nx: [2, 1],
            ny: [23, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 1],
            py: [18, 3],
            pz: [0, 2],
            nx: [11, 3],
            ny: [16, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 8],
            py: [6, 10],
            pz: [1, 0],
            nx: [9, 0],
            ny: [9, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [20, 10],
            py: [21, 7],
            pz: [0, 1],
            nx: [7, 2],
            ny: [3, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 6],
            py: [4, 7],
            pz: [1, -1],
            nx: [23, 5],
            ny: [9, 2],
            nz: [0, 2]
          },
          {
            size: 5,
            px: [2, 4, 5, 3, 4],
            py: [0, 1, 1, 2, 2],
            pz: [1, 0, 0, 0, 0],
            nx: [1, 0, 1, 1, 1],
            ny: [2, 1, 0, 1, 1],
            nz: [0, 1, 0, 0, -1]
          },
          {
            size: 2,
            px: [8, 16],
            py: [7, 13],
            pz: [1, 0],
            nx: [8, 3],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 15],
            py: [7, 19],
            pz: [0, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [11, 5],
            pz: [1, 2],
            nx: [7, 8],
            ny: [9, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [23, 11],
            py: [9, 6],
            pz: [0, 1],
            nx: [22, 22],
            ny: [23, 23],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [23, 23],
            py: [21, 20],
            pz: [0, 0],
            nx: [2, 2],
            ny: [5, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 4],
            py: [12, 2],
            pz: [0, -1],
            nx: [9, 8],
            ny: [4, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 14],
            py: [2, 4],
            pz: [1, 0],
            nx: [7, 18],
            ny: [1, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [20, 22],
            py: [1, 2],
            pz: [0, 0],
            nx: [23, 23],
            ny: [1, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 1],
            py: [9, 10],
            pz: [1, 1],
            nx: [8, 0],
            ny: [15, 0],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [11, 11, 6],
            py: [10, 11, 11],
            pz: [0, 0, -1],
            nx: [23, 23, 23],
            ny: [19, 21, 20],
            nz: [0, 0, 0]
          },
          {
            size: 5,
            px: [23, 23, 23, 6, 6],
            py: [21, 22, 22, 3, 6],
            pz: [0, 0, -1, -1, -1],
            nx: [8, 8, 8, 17, 4],
            ny: [7, 10, 8, 16, 5],
            nz: [1, 1, 1, 0, 2]
          },
          {
            size: 2,
            px: [10, 23],
            py: [1, 22],
            pz: [0, -1],
            nx: [7, 2],
            ny: [11, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [7, 14],
            py: [3, 10],
            pz: [1, -1],
            nx: [5, 3],
            ny: [2, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [5, 3],
            py: [13, 7],
            pz: [0, 1],
            nx: [4, 10],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [15, 6],
            pz: [0, -1],
            nx: [3, 6],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [13, 4],
            py: [18, 17],
            pz: [0, -1],
            nx: [7, 6],
            ny: [10, 7],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [12, 11],
            py: [3, 8],
            pz: [0, -1],
            nx: [7, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [17, 4],
            py: [5, 7],
            pz: [0, 1],
            nx: [17, 10],
            ny: [4, 0],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [16, 8, 16, 15, 15],
            py: [0, 0, 1, 0, 1],
            pz: [0, 1, 0, 0, 0],
            nx: [7, 4, 7, 4, 4],
            ny: [7, 5, 8, 1, 1],
            nz: [1, 2, 1, 2, -1]
          },
          {
            size: 2,
            px: [13, 11],
            py: [5, 6],
            pz: [0, -1],
            nx: [4, 5],
            ny: [2, 2],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [3, 6],
            pz: [2, 1],
            nx: [8, 4],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 16],
            py: [8, 10],
            pz: [0, 0],
            nx: [7, 2],
            ny: [3, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 8],
            py: [4, 11],
            pz: [1, 0],
            nx: [10, 1],
            ny: [9, 20],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 1],
            py: [4, 2],
            pz: [2, -1],
            nx: [23, 23],
            ny: [15, 16],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [9, 8, 2, 4, 9],
            py: [1, 1, 0, 1, 2],
            pz: [0, 0, 2, 1, 0],
            nx: [8, 3, 8, 4, 4],
            ny: [6, 2, 4, 2, 2],
            nz: [1, 2, 1, 2, -1]
          },
          {
            size: 2,
            px: [13, 6],
            py: [10, 5],
            pz: [0, -1],
            nx: [13, 7],
            ny: [6, 3],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [10, 5],
            pz: [1, 2],
            nx: [10, 8],
            ny: [10, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [9, 14],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [5, 2, 15],
            py: [3, 1, 22],
            pz: [1, -1, -1],
            nx: [15, 9, 4],
            ny: [0, 1, 0],
            nz: [0, 1, 2]
          },
          {
            size: 2,
            px: [10, 19],
            py: [9, 21],
            pz: [1, 0],
            nx: [2, 17],
            ny: [5, 14],
            nz: [2, -1]
          },
          {
            size: 3,
            px: [16, 2, 1],
            py: [2, 10, 4],
            pz: [0, -1, -1],
            nx: [4, 4, 9],
            ny: [3, 2, 6],
            nz: [2, 2, 1]
          },
          {
            size: 2,
            px: [10, 2],
            py: [6, 10],
            pz: [1, -1],
            nx: [21, 22],
            ny: [16, 12],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [7, 16],
            py: [4, 23],
            pz: [0, -1],
            nx: [7, 3],
            ny: [3, 3],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [1, 1],
            py: [13, 14],
            pz: [0, 0],
            nx: [1, 2],
            ny: [18, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [18, 5],
            py: [13, 4],
            pz: [0, -1],
            nx: [4, 13],
            ny: [2, 11],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [18, 17],
            py: [3, 3],
            pz: [0, 0],
            nx: [19, 19],
            ny: [1, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 5],
            py: [0, 5],
            pz: [1, -1],
            nx: [12, 3],
            ny: [5, 1],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [5, 3],
            py: [2, 1],
            pz: [1, 2],
            nx: [18, 4],
            ny: [4, 1],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [13, 13, 2, 10, 15],
            py: [11, 12, 13, 17, 23],
            pz: [0, -1, -1, -1, -1],
            nx: [12, 13, 4, 3, 8],
            ny: [4, 4, 1, 0, 3],
            nz: [0, 0, 2, 2, 1]
          },
          {
            size: 2,
            px: [9, 3],
            py: [2, 2],
            pz: [0, -1],
            nx: [4, 2],
            ny: [7, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [13, 4],
            py: [5, 1],
            pz: [0, -1],
            nx: [18, 4],
            ny: [12, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [19, 4],
            py: [11, 1],
            pz: [0, -1],
            nx: [4, 7],
            ny: [2, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [3, 2],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [4, 0],
            py: [7, 7],
            pz: [0, -1],
            nx: [4, 9],
            ny: [0, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 9],
            py: [0, 2],
            pz: [2, 1],
            nx: [6, 4],
            ny: [3, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [9, 4],
            pz: [1, 2],
            nx: [13, 5],
            ny: [18, 2],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [5, 23, 23],
            py: [2, 8, 7],
            pz: [2, 0, 0],
            nx: [10, 12, 1],
            ny: [4, 1, 0],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [13, 0],
            py: [3, 3],
            pz: [0, -1],
            nx: [4, 4],
            ny: [2, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [6, 5],
            py: [10, 5],
            pz: [0, -1],
            nx: [0, 0],
            ny: [4, 11],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [11, 2],
            py: [14, 11],
            pz: [0, -1],
            nx: [10, 11],
            ny: [4, 13],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [5, 6],
            py: [21, 23],
            pz: [0, 0],
            nx: [7, 0],
            ny: [21, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [8, 5],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 6],
            py: [8, 8],
            pz: [0, 0],
            nx: [6, 14],
            ny: [9, 15],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 6],
            py: [4, 8],
            pz: [0, -1],
            nx: [16, 8],
            ny: [0, 1],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [3, 6, 0, 9],
            py: [0, 8, 5, 23],
            pz: [1, -1, -1, -1],
            nx: [12, 2, 6, 10],
            ny: [5, 0, 3, 5],
            nz: [0, 2, 1, 0]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 13],
            pz: [1, 0],
            nx: [3, 9],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 5],
            py: [8, 23],
            pz: [1, 0],
            nx: [8, 9],
            ny: [15, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 18],
            py: [8, 0],
            pz: [0, -1],
            nx: [1, 1],
            ny: [9, 8],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [2, 7],
            py: [4, 21],
            pz: [2, 0],
            nx: [13, 11],
            ny: [8, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 4],
            py: [8, 8],
            pz: [0, 0],
            nx: [6, 1],
            ny: [8, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 3],
            py: [20, 7],
            pz: [0, -1],
            nx: [4, 3],
            ny: [10, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [8, 7],
            pz: [1, -1],
            nx: [1, 2],
            ny: [4, 9],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [5, 10],
            py: [5, 13],
            pz: [1, -1],
            nx: [3, 6],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [6, 3],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [4, 4],
            pz: [1, -1],
            nx: [5, 11],
            ny: [2, 5],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [11, 23, 11, 23, 11],
            py: [4, 9, 5, 10, 6],
            pz: [1, 0, 1, 0, 1],
            nx: [7, 14, 13, 7, 3],
            ny: [9, 5, 6, 4, 4],
            nz: [0, 0, 0, 1, -1]
          },
          {
            size: 2,
            px: [8, 5],
            py: [0, 0],
            pz: [1, -1],
            nx: [9, 20],
            ny: [1, 4],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [19, 20],
            py: [0, 3],
            pz: [0, 0],
            nx: [4, 6],
            ny: [11, 3],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [13, 5, 20, 5],
            py: [14, 3, 23, 4],
            pz: [0, -1, -1, -1],
            nx: [8, 15, 7, 16],
            ny: [8, 14, 6, 15],
            nz: [1, 0, 1, 0]
          },
          {
            size: 2,
            px: [10, 20],
            py: [5, 17],
            pz: [0, -1],
            nx: [7, 3],
            ny: [10, 1],
            nz: [0, 2]
          },
          {
            size: 3,
            px: [1, 12, 7],
            py: [3, 7, 10],
            pz: [2, 0, 0],
            nx: [2, 2, 3],
            ny: [3, 2, 2],
            nz: [1, -1, -1]
          },
          {
            size: 3,
            px: [10, 5, 7],
            py: [7, 10, 10],
            pz: [1, -1, -1],
            nx: [10, 10, 18],
            ny: [10, 9, 23],
            nz: [1, 1, 0]
          },
          {
            size: 3,
            px: [14, 14, 4],
            py: [3, 3, 4],
            pz: [0, -1, -1],
            nx: [4, 4, 8],
            ny: [3, 2, 6],
            nz: [2, 2, 1]
          },
          {
            size: 2,
            px: [4, 12],
            py: [4, 17],
            pz: [2, 0],
            nx: [13, 1],
            ny: [15, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 20],
            py: [9, 22],
            pz: [0, -1],
            nx: [9, 4],
            ny: [2, 0],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [11, 2],
            py: [3, 6],
            pz: [0, -1],
            nx: [2, 4],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 3,
            px: [15, 10, 1],
            py: [12, 2, 3],
            pz: [0, -1, -1],
            nx: [7, 5, 10],
            ny: [2, 1, 1],
            nz: [0, 1, 0]
          },
          {
            size: 5,
            px: [9, 11, 10, 12, 12],
            py: [0, 0, 0, 0, 0],
            pz: [0, 0, 0, 0, -1],
            nx: [8, 4, 16, 5, 10],
            ny: [4, 4, 10, 3, 6],
            nz: [1, 1, 0, 1, 0]
          },
          {
            size: 2,
            px: [0, 10],
            py: [3, 5],
            pz: [2, -1],
            nx: [3, 6],
            ny: [0, 1],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [7, 8, 7, 2, 12],
            py: [14, 13, 13, 16, 0],
            pz: [0, 0, -1, -1, -1],
            nx: [10, 1, 10, 1, 1],
            ny: [13, 2, 12, 4, 9],
            nz: [0, 2, 0, 1, 0]
          },
          {
            size: 3,
            px: [6, 14, 13],
            py: [1, 2, 1],
            pz: [1, 0, 0],
            nx: [8, 21, 10],
            ny: [4, 23, 12],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [19, 19],
            py: [22, 21],
            pz: [0, 0],
            nx: [20, 1],
            ny: [22, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 12],
            py: [19, 22],
            pz: [0, -1],
            nx: [2, 3],
            ny: [0, 1],
            nz: [2, 1]
          },
          {
            size: 4,
            px: [11, 9, 21, 4],
            py: [13, 3, 19, 5],
            pz: [0, -1, -1, -1],
            nx: [9, 9, 9, 5],
            ny: [13, 14, 12, 6],
            nz: [0, 0, 0, 1]
          },
          {
            size: 4,
            px: [11, 12, 13, 14],
            py: [22, 22, 22, 22],
            pz: [0, 0, 0, 0],
            nx: [13, 2, 4, 5],
            ny: [20, 0, 0, 6],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [3, 1],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [0, 1],
            pz: [2, 2],
            nx: [9, 4],
            ny: [6, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 0],
            py: [10, 1],
            pz: [0, -1],
            nx: [9, 4],
            ny: [3, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [10, 4],
            py: [3, 1],
            pz: [1, 2],
            nx: [12, 18],
            ny: [17, 4],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [2, 3, 4],
            py: [4, 3, 9],
            pz: [2, 2, 1],
            nx: [0, 3, 17],
            ny: [0, 1, 18],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [7, 3],
            py: [12, 6],
            pz: [0, 1],
            nx: [5, 1],
            ny: [11, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 17],
            py: [20, 6],
            pz: [0, -1],
            nx: [5, 2],
            ny: [9, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [8, 11],
            py: [18, 2],
            pz: [0, -1],
            nx: [5, 4],
            ny: [9, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [16, 15],
            py: [2, 2],
            pz: [0, 0],
            nx: [17, 12],
            ny: [2, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [18, 4],
            py: [5, 5],
            pz: [0, -1],
            nx: [7, 5],
            ny: [23, 19],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 13],
            py: [23, 23],
            pz: [0, 0],
            nx: [7, 11],
            ny: [10, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 10],
            py: [3, 18],
            pz: [2, -1],
            nx: [9, 9],
            ny: [5, 6],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [5, 10],
            py: [2, 4],
            pz: [1, 0],
            nx: [4, 23],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [8, 1],
            pz: [1, -1],
            nx: [15, 12],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 7],
            py: [3, 10],
            pz: [2, 1],
            nx: [10, 1],
            ny: [20, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [10, 11],
            pz: [0, 0],
            nx: [22, 3],
            ny: [5, 4],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [8, 17, 17, 9, 18],
            py: [0, 1, 0, 1, 0],
            pz: [1, 0, 0, 1, 0],
            nx: [11, 8, 9, 4, 4],
            ny: [23, 4, 6, 2, 2],
            nz: [0, 1, 0, 2, -1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [4, 4],
            pz: [1, -1],
            nx: [13, 4],
            ny: [9, 2],
            nz: [0, 2]
          },
          {
            size: 5,
            px: [9, 4, 8, 7, 7],
            py: [3, 1, 3, 3, 3],
            pz: [0, 1, 0, 0, -1],
            nx: [4, 2, 5, 3, 2],
            ny: [1, 15, 1, 4, 13],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [17, 7],
            py: [13, 7],
            pz: [0, -1],
            nx: [4, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [1, 2],
            py: [1, 12],
            pz: [2, 0],
            nx: [9, 21],
            ny: [5, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 0],
            py: [14, 1],
            pz: [0, -1],
            nx: [1, 1],
            ny: [19, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [16, 1],
            py: [5, 9],
            pz: [0, -1],
            nx: [16, 15],
            ny: [3, 3],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 8],
            py: [3, 6],
            pz: [2, 1],
            nx: [8, 4],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 6],
            py: [17, 15],
            pz: [0, 0],
            nx: [11, 0],
            ny: [16, 4],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [12, 11, 0, 3],
            py: [16, 8, 7, 1],
            pz: [0, -1, -1, -1],
            nx: [10, 5, 10, 5],
            ny: [11, 9, 10, 8],
            nz: [0, 1, 0, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 13],
            pz: [1, 0],
            nx: [4, 14],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 17],
            py: [6, 13],
            pz: [0, -1],
            nx: [4, 8],
            ny: [4, 9],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [15, 11],
            py: [3, 2],
            pz: [0, -1],
            nx: [4, 15],
            ny: [1, 2],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [10, 11],
            py: [18, 4],
            pz: [0, -1],
            nx: [5, 5],
            ny: [8, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [7, 4],
            pz: [1, 2],
            nx: [4, 3],
            ny: [5, 7],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [12, 4],
            py: [15, 4],
            pz: [0, -1],
            nx: [11, 8],
            ny: [14, 19],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [18, 13],
            py: [13, 20],
            pz: [0, 0],
            nx: [13, 4],
            ny: [18, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 4],
            py: [6, 3],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [21, 5, 11, 5, 10],
            py: [1, 1, 3, 0, 0],
            pz: [0, 2, 1, 2, 1],
            nx: [7, 14, 15, 4, 8],
            ny: [3, 6, 11, 3, 4],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [10, 6],
            py: [15, 10],
            pz: [0, -1],
            nx: [21, 22],
            ny: [14, 12],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [18, 0],
            py: [20, 0],
            pz: [0, -1],
            nx: [2, 3],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [12, 6, 13, 11, 7],
            py: [1, 1, 1, 2, 1],
            pz: [0, 1, 0, 0, 1],
            nx: [7, 6, 8, 5, 5],
            ny: [4, 15, 4, 16, 16],
            nz: [1, 0, 1, 0, -1]
          },
          {
            size: 3,
            px: [22, 21, 21],
            py: [14, 15, 17],
            pz: [0, 0, 0],
            nx: [5, 9, 4],
            ny: [0, 5, 0],
            nz: [2, -1, -1]
          },
          {
            size: 2,
            px: [10, 2],
            py: [14, 1],
            pz: [0, -1],
            nx: [23, 11],
            ny: [16, 8],
            nz: [0, 1]
          },
          {
            size: 4,
            px: [21, 21, 0, 18],
            py: [14, 15, 5, 4],
            pz: [0, 0, -1, -1],
            nx: [8, 8, 9, 4],
            ny: [7, 8, 10, 5],
            nz: [1, 1, 1, 2]
          },
          {
            size: 2,
            px: [15, 5],
            py: [18, 1],
            pz: [0, -1],
            nx: [23, 23],
            ny: [16, 18],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [15, 14],
            py: [1, 1],
            pz: [0, 0],
            nx: [4, 4],
            ny: [2, 3],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [2, 6],
            py: [6, 5],
            pz: [1, -1],
            nx: [14, 11],
            ny: [1, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 17],
            py: [2, 8],
            pz: [2, 0],
            nx: [8, 3],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 8],
            py: [13, 10],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [0, 0],
            py: [8, 3],
            pz: [0, 1],
            nx: [1, 11],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 8],
            py: [5, 0],
            pz: [1, -1],
            nx: [0, 0],
            ny: [3, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 3],
            pz: [1, 2],
            nx: [1, 18],
            ny: [5, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 3],
            py: [6, 6],
            pz: [0, 1],
            nx: [7, 12],
            ny: [5, 20],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 1],
            py: [0, 5],
            pz: [0, -1],
            nx: [4, 2],
            ny: [9, 3],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [0, 0],
            py: [10, 11],
            pz: [0, 0],
            nx: [0, 5],
            ny: [5, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 1],
            py: [23, 4],
            pz: [0, 2],
            nx: [0, 0],
            ny: [13, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 1],
            py: [6, 4],
            pz: [0, -1],
            nx: [4, 4],
            ny: [4, 5],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [7, 6],
            py: [6, 5],
            pz: [1, 1],
            nx: [3, 9],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 3],
            py: [9, 13],
            pz: [0, -1],
            nx: [4, 10],
            ny: [3, 7],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [13, 9, 6, 10, 10],
            py: [2, 2, 1, 2, 2],
            pz: [0, 0, 1, 0, -1],
            nx: [7, 5, 6, 5, 6],
            ny: [0, 2, 2, 1, 1],
            nz: [0, 0, 0, 0, 0]
          }
        ],
        alpha: [
          -1.119615,
          1.119615,
          -8.169953e-1,
          8.169953e-1,
          -5.291213e-1,
          5.291213e-1,
          -4.904488e-1,
          4.904488e-1,
          -4.930982e-1,
          4.930982e-1,
          -4.106179e-1,
          4.106179e-1,
          -4.246842e-1,
          4.246842e-1,
          -3.802383e-1,
          3.802383e-1,
          -3.364358e-1,
          3.364358e-1,
          -3.214186e-1,
          3.214186e-1,
          -3.210798e-1,
          3.210798e-1,
          -2.993167e-1,
          2.993167e-1,
          -3.426336e-1,
          3.426336e-1,
          -3.199184e-1,
          3.199184e-1,
          -3.061071e-1,
          3.061071e-1,
          -2.758972e-1,
          2.758972e-1,
          -3.07559e-1,
          3.07559e-1,
          -3.009565e-1,
          3.009565e-1,
          -2.015739e-1,
          2.015739e-1,
          -2.603266e-1,
          2.603266e-1,
          -2.772993e-1,
          2.772993e-1,
          -2.184913e-1,
          2.184913e-1,
          -2.306681e-1,
          2.306681e-1,
          -1.983223e-1,
          1.983223e-1,
          -2.19476e-1,
          2.19476e-1,
          -2.528421e-1,
          2.528421e-1,
          -2.436416e-1,
          2.436416e-1,
          -3.032886e-1,
          3.032886e-1,
          -2.556071e-1,
          2.556071e-1,
          -2.56217e-1,
          2.56217e-1,
          -1.930298e-1,
          1.930298e-1,
          -2.735898e-1,
          2.735898e-1,
          -1.814703e-1,
          1.814703e-1,
          -2.054824e-1,
          2.054824e-1,
          -1.986146e-1,
          1.986146e-1,
          -1.769226e-1,
          1.769226e-1,
          -1.775257e-1,
          1.775257e-1,
          -2.167927e-1,
          2.167927e-1,
          -1.823633e-1,
          1.823633e-1,
          -1.58428e-1,
          1.58428e-1,
          -1.778321e-1,
          1.778321e-1,
          -1.826777e-1,
          1.826777e-1,
          -1.979903e-1,
          1.979903e-1,
          -1.898326e-1,
          1.898326e-1,
          -1.835506e-1,
          1.835506e-1,
          -1.96786e-1,
          1.96786e-1,
          -1.871528e-1,
          1.871528e-1,
          -1.772414e-1,
          1.772414e-1,
          -1.985514e-1,
          1.985514e-1,
          -2.144078e-1,
          2.144078e-1,
          -2.742303e-1,
          2.742303e-1,
          -2.24055e-1,
          2.24055e-1,
          -2.132534e-1,
          2.132534e-1,
          -1.552127e-1,
          1.552127e-1,
          -1.568276e-1,
          1.568276e-1,
          -1.630086e-1,
          1.630086e-1,
          -1.458232e-1,
          1.458232e-1,
          -1.559541e-1,
          1.559541e-1,
          -1.720131e-1,
          1.720131e-1,
          -1.708434e-1,
          1.708434e-1,
          -1.624431e-1,
          1.624431e-1,
          -1.814161e-1,
          1.814161e-1,
          -1.552639e-1,
          1.552639e-1,
          -1.242354e-1,
          1.242354e-1,
          -1.552139e-1,
          1.552139e-1,
          -1.694359e-1,
          1.694359e-1,
          -1.801481e-1,
          1.801481e-1,
          -1.387182e-1,
          1.387182e-1,
          -1.409679e-1,
          1.409679e-1,
          -1.486724e-1,
          1.486724e-1,
          -1.779553e-1,
          1.779553e-1,
          -1.524595e-1,
          1.524595e-1,
          -1.788086e-1,
          1.788086e-1,
          -1.671479e-1,
          1.671479e-1,
          -1.376197e-1,
          1.376197e-1,
          -1.511808e-1,
          1.511808e-1,
          -1.524632e-1,
          1.524632e-1,
          -1.198986e-1,
          1.198986e-1,
          -1.382641e-1,
          1.382641e-1,
          -1.148901e-1,
          1.148901e-1,
          -1.131803e-1,
          1.131803e-1,
          -1.273508e-1,
          1.273508e-1,
          -1.405125e-1,
          1.405125e-1,
          -1.322132e-1,
          1.322132e-1,
          -1.386966e-1,
          1.386966e-1,
          -1.275621e-1,
          1.275621e-1,
          -1.180573e-1,
          1.180573e-1,
          -1.238803e-1,
          1.238803e-1,
          -1.428389e-1,
          1.428389e-1,
          -1.694437e-1,
          1.694437e-1,
          -1.290855e-1,
          1.290855e-1,
          -1.52026e-1,
          1.52026e-1,
          -1.398282e-1,
          1.398282e-1,
          -1.890736e-1,
          1.890736e-1,
          -2.280428e-1,
          2.280428e-1,
          -1.325099e-1,
          1.325099e-1,
          -1.342873e-1,
          1.342873e-1,
          -1.463841e-1,
          1.463841e-1,
          -1.983567e-1,
          1.983567e-1,
          -1.585711e-1,
          1.585711e-1,
          -1.260154e-1,
          1.260154e-1,
          -1.426774e-1,
          1.426774e-1,
          -1.554278e-1,
          1.554278e-1,
          -1.361201e-1,
          1.361201e-1,
          -1.181856e-1,
          1.181856e-1,
          -1.255941e-1,
          1.255941e-1,
          -1.113275e-1,
          1.113275e-1,
          -1.506576e-1,
          1.506576e-1,
          -1.202859e-1,
          1.202859e-1,
          -2.159751e-1,
          2.159751e-1,
          -1.44315e-1,
          1.44315e-1,
          -1.379194e-1,
          1.379194e-1,
          -1.805758e-1,
          1.805758e-1,
          -1.465612e-1,
          1.465612e-1,
          -1.328856e-1,
          1.328856e-1,
          -1.532173e-1,
          1.532173e-1,
          -1.590635e-1,
          1.590635e-1,
          -1.462229e-1,
          1.462229e-1,
          -1.350012e-1,
          1.350012e-1,
          -1.195634e-1,
          1.195634e-1,
          -1.173221e-1,
          1.173221e-1,
          -1.192867e-1,
          1.192867e-1,
          -1.595013e-1,
          1.595013e-1,
          -1.209751e-1,
          1.209751e-1,
          -1.57129e-1,
          1.57129e-1,
          -1.527274e-1,
          1.527274e-1,
          -1.373708e-1,
          1.373708e-1,
          -1.318313e-1,
          1.318313e-1,
          -1.273391e-1,
          1.273391e-1,
          -1.271365e-1,
          1.271365e-1,
          -1.528693e-1,
          1.528693e-1,
          -1.590476e-1,
          1.590476e-1,
          -1.581911e-1,
          1.581911e-1,
          -1.183023e-1,
          1.183023e-1,
          -1.559822e-1,
          1.559822e-1,
          -1.214999e-1,
          1.214999e-1,
          -1.283378e-1,
          1.283378e-1,
          -1.542583e-1,
          1.542583e-1,
          -1.336377e-1,
          1.336377e-1,
          -1.800416e-1,
          1.800416e-1,
          -1.710931e-1,
          1.710931e-1,
          -1.621737e-1,
          1.621737e-1,
          -1.239002e-1,
          1.239002e-1,
          -1.432928e-1,
          1.432928e-1,
          -1.392447e-1,
          1.392447e-1,
          -1.383938e-1,
          1.383938e-1,
          -1.357633e-1,
          1.357633e-1,
          -1.175842e-1,
          1.175842e-1,
          -1.085318e-1,
          1.085318e-1,
          -1.148885e-1,
          1.148885e-1,
          -1.320396e-1,
          1.320396e-1,
          -1.351204e-1,
          1.351204e-1,
          -1.581518e-1,
          1.581518e-1,
          -1.459574e-1,
          1.459574e-1,
          -1.180068e-1,
          1.180068e-1,
          -1.464196e-1,
          1.464196e-1,
          -1.179543e-1,
          1.179543e-1,
          -1.004204e-1,
          1.004204e-1,
          -1.29466e-1,
          1.29466e-1,
          -1.534244e-1,
          1.534244e-1,
          -1.37897e-1,
          1.37897e-1,
          -1.226545e-1,
          1.226545e-1,
          -1.281182e-1,
          1.281182e-1,
          -1.201471e-1,
          1.201471e-1,
          -1.448701e-1,
          1.448701e-1,
          -1.29098e-1,
          1.29098e-1,
          -1.388764e-1,
          1.388764e-1,
          -9.605773e-2,
          9.605773e-2,
          -1.411021e-1,
          1.411021e-1,
          -1.295693e-1,
          1.295693e-1,
          -1.371739e-1,
          1.371739e-1,
          -1.167579e-1,
          1.167579e-1,
          -1.400486e-1,
          1.400486e-1,
          -1.214224e-1,
          1.214224e-1,
          -1.287835e-1,
          1.287835e-1,
          -1.197646e-1,
          1.197646e-1,
          -1.192358e-1,
          1.192358e-1,
          -1.218651e-1,
          1.218651e-1,
          -1.564816e-1,
          1.564816e-1,
          -1.172391e-1,
          1.172391e-1,
          -1.342268e-1,
          1.342268e-1,
          -1.492471e-1,
          1.492471e-1,
          -1.157299e-1,
          1.157299e-1,
          -1.046703e-1,
          1.046703e-1,
          -1.255571e-1,
          1.255571e-1,
          -1.100135e-1,
          1.100135e-1,
          -1.501592e-1,
          1.501592e-1,
          -1.155712e-1,
          1.155712e-1,
          -1.145563e-1,
          1.145563e-1,
          -1.013425e-1,
          1.013425e-1,
          -1.145783e-1,
          1.145783e-1,
          -1.328031e-1,
          1.328031e-1,
          -1.077413e-1,
          1.077413e-1,
          -1.064996e-1,
          1.064996e-1,
          -1.19117e-1,
          1.19117e-1,
          -1.213217e-1,
          1.213217e-1,
          -1.260969e-1,
          1.260969e-1,
          -1.156494e-1,
          1.156494e-1,
          -1.268126e-1,
          1.268126e-1,
          -1.070999e-1,
          1.070999e-1,
          -1.112365e-1,
          1.112365e-1,
          -1.243916e-1,
          1.243916e-1,
          -1.283152e-1,
          1.283152e-1,
          -1.166925e-1,
          1.166925e-1,
          -8.997633e-2,
          8.997633e-2,
          -1.58384e-1,
          1.58384e-1,
          -1.211178e-1,
          1.211178e-1,
          -1.09083e-1,
          1.09083e-1,
          -1.030818e-1,
          1.030818e-1,
          -1.4406e-1,
          1.4406e-1,
          -1.458713e-1,
          1.458713e-1,
          -1.559082e-1,
          1.559082e-1,
          -1.058868e-1,
          1.058868e-1,
          -1.01013e-1,
          1.01013e-1,
          -1.642301e-1,
          1.642301e-1,
          -1.23685e-1,
          1.23685e-1,
          -1.467589e-1,
          1.467589e-1,
          -1.109359e-1,
          1.109359e-1,
          -1.673655e-1,
          1.673655e-1,
          -1.239984e-1,
          1.239984e-1,
          -1.039509e-1,
          1.039509e-1,
          -1.089378e-1,
          1.089378e-1,
          -1.545085e-1,
          1.545085e-1,
          -1.200862e-1,
          1.200862e-1,
          -1.105608e-1,
          1.105608e-1,
          -1.235262e-1,
          1.235262e-1,
          -8.496153e-2,
          8.496153e-2,
          -1.181372e-1,
          1.181372e-1,
          -1.139467e-1,
          1.139467e-1,
          -1.189317e-1,
          1.189317e-1,
          -1.266519e-1,
          1.266519e-1,
          -9.470736e-2,
          9.470736e-2,
          -1.336735e-1,
          1.336735e-1,
          -8.726601e-2,
          8.726601e-2,
          -1.304782e-1,
          1.304782e-1,
          -1.186529e-1,
          1.186529e-1,
          -1.355944e-1,
          1.355944e-1,
          -9.568801e-2,
          9.568801e-2,
          -1.282618e-1,
          1.282618e-1,
          -1.625632e-1,
          1.625632e-1,
          -1.167652e-1,
          1.167652e-1,
          -1.001301e-1,
          1.001301e-1,
          -1.292419e-1,
          1.292419e-1,
          -1.904213e-1,
          1.904213e-1,
          -1.511542e-1,
          1.511542e-1,
          -9.814394e-2,
          9.814394e-2,
          -1.171564e-1,
          1.171564e-1,
          -9.806486e-2,
          9.806486e-2,
          -9.217615e-2,
          9.217615e-2,
          -8.505645e-2,
          8.505645e-2,
          -1.573637e-1,
          1.573637e-1,
          -1.419174e-1,
          1.419174e-1,
          -1.298601e-1,
          1.298601e-1,
          -1.120613e-1,
          1.120613e-1,
          -1.158363e-1,
          1.158363e-1,
          -1.090957e-1,
          1.090957e-1,
          -1.204516e-1,
          1.204516e-1,
          -1.139852e-1,
          1.139852e-1,
          -9.642479e-2,
          9.642479e-2,
          -1.410872e-1,
          1.410872e-1,
          -1.142779e-1,
          1.142779e-1,
          -1.043991e-1,
          1.043991e-1,
          -9.736463e-2,
          9.736463e-2,
          -1.451046e-1,
          1.451046e-1,
          -1.205668e-1,
          1.205668e-1,
          -9.881445e-2,
          9.881445e-2,
          -1.612822e-1,
          1.612822e-1,
          -1.175681e-1,
          1.175681e-1,
          -1.522528e-1,
          1.522528e-1,
          -1.61752e-1,
          1.61752e-1,
          -1.582938e-1,
          1.582938e-1,
          -1.208202e-1,
          1.208202e-1,
          -1.016003e-1,
          1.016003e-1,
          -1.232059e-1,
          1.232059e-1,
          -9.583025e-2,
          9.583025e-2,
          -1.01399e-1,
          1.01399e-1,
          -1.178752e-1,
          1.178752e-1,
          -1.215972e-1,
          1.215972e-1,
          -1.294932e-1,
          1.294932e-1,
          -1.15827e-1,
          1.15827e-1,
          -1.008645e-1,
          1.008645e-1,
          -9.69919e-2,
          9.69919e-2,
          -1.022144e-1,
          1.022144e-1,
          -9.878768e-2,
          9.878768e-2,
          -1.339052e-1,
          1.339052e-1,
          -9.279961e-2,
          9.279961e-2,
          -1.047606e-1,
          1.047606e-1,
          -1.141163e-1,
          1.141163e-1,
          -1.2676e-1,
          1.2676e-1,
          -1.252763e-1,
          1.252763e-1,
          -9.775003e-2,
          9.775003e-2,
          -9.169116e-2,
          9.169116e-2,
          -1.006496e-1,
          1.006496e-1,
          -9.493293e-2,
          9.493293e-2,
          -1.213694e-1,
          1.213694e-1,
          -1.109243e-1,
          1.109243e-1,
          -1.115973e-1,
          1.115973e-1,
          -7.979327e-2,
          7.979327e-2,
          -9.220953e-2,
          9.220953e-2,
          -1.028913e-1,
          1.028913e-1,
          -1.25351e-1,
          1.25351e-1
        ]
      },
      {
        count: 391,
        threshold: -4.665692,
        feature: [
          {
            size: 5,
            px: [14, 9, 11, 17, 12],
            py: [2, 3, 9, 13, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [21, 8, 7, 20, 13],
            ny: [16, 10, 7, 7, 9],
            nz: [0, 1, 1, 0, 0]
          },
          {
            size: 5,
            px: [12, 10, 6, 11, 13],
            py: [9, 3, 13, 3, 4],
            pz: [0, 0, 0, 0, 0],
            nx: [10, 4, 5, 10, 2],
            ny: [9, 10, 8, 8, 2],
            nz: [0, 1, 1, 0, 2]
          },
          {
            size: 5,
            px: [6, 9, 7, 8, 8],
            py: [3, 3, 3, 3, 3],
            pz: [0, 0, 0, 0, -1],
            nx: [0, 0, 0, 4, 9],
            ny: [4, 2, 3, 10, 8],
            nz: [0, 0, 0, 1, 0]
          },
          {
            size: 5,
            px: [6, 2, 16, 6, 8],
            py: [16, 2, 11, 4, 11],
            pz: [0, 2, 0, 1, 0],
            nx: [3, 8, 4, 1, 1],
            ny: [4, 4, 4, 5, 13],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 3,
            px: [16, 13, 9],
            py: [23, 18, 10],
            pz: [0, 0, 1],
            nx: [14, 15, 8],
            ny: [21, 22, 3],
            nz: [0, -1, -1]
          },
          {
            size: 5,
            px: [9, 16, 19, 17, 17],
            py: [1, 2, 3, 2, 2],
            pz: [1, 0, 0, 0, -1],
            nx: [23, 23, 23, 23, 23],
            ny: [6, 2, 1, 3, 5],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [12, 12, 12, 12, 12],
            py: [10, 11, 12, 13, 13],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 8, 14, 4, 6],
            ny: [2, 4, 7, 4, 8],
            nz: [2, 1, 0, 1, 1]
          },
          {
            size: 5,
            px: [1, 2, 3, 6, 4],
            py: [6, 10, 12, 23, 13],
            pz: [1, 1, 0, 0, 0],
            nx: [2, 0, 0, 1, 1],
            ny: [23, 5, 10, 21, 21],
            nz: [0, 2, 1, 0, -1]
          },
          {
            size: 5,
            px: [12, 16, 12, 4, 12],
            py: [6, 17, 7, 2, 8],
            pz: [0, 0, 0, 2, 0],
            nx: [8, 8, 12, 0, 6],
            ny: [4, 4, 16, 0, 8],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [9, 2],
            py: [18, 4],
            pz: [0, -1],
            nx: [4, 9],
            ny: [10, 16],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [9, 9, 2, 0, 12],
            py: [6, 6, 21, 4, 8],
            pz: [1, -1, -1, -1, -1],
            nx: [8, 4, 9, 7, 7],
            ny: [10, 2, 4, 5, 8],
            nz: [1, 2, 1, 1, 1]
          },
          {
            size: 5,
            px: [10, 10, 10, 18, 19],
            py: [10, 8, 7, 14, 14],
            pz: [1, 1, 1, 0, 0],
            nx: [21, 23, 22, 22, 11],
            ny: [23, 19, 21, 22, 10],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [12, 3, 15, 4, 19],
            py: [14, 0, 5, 5, 14],
            pz: [0, -1, -1, -1, -1],
            nx: [12, 17, 15, 3, 8],
            ny: [18, 18, 14, 2, 10],
            nz: [0, 0, 0, 2, 0]
          },
          {
            size: 5,
            px: [8, 11, 3, 11, 4],
            py: [23, 7, 9, 8, 8],
            pz: [0, 0, 1, 0, 1],
            nx: [8, 0, 10, 0, 8],
            ny: [8, 2, 8, 4, 10],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [10, 11, 12, 8, 4],
            py: [3, 0, 0, 1, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [2, 3, 4, 3, 3],
            ny: [14, 5, 0, 1, 2],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [3, 11],
            py: [7, 0],
            pz: [1, -1],
            nx: [5, 2],
            ny: [9, 5],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [7, 1, 0, 10, 1],
            py: [0, 0, 2, 12, 6],
            pz: [0, 2, 2, 0, 1],
            nx: [4, 6, 2, 8, 8],
            ny: [4, 11, 2, 4, 4],
            nz: [1, 1, 2, 1, -1]
          },
          {
            size: 2,
            px: [4, 15],
            py: [4, 12],
            pz: [2, 0],
            nx: [4, 6],
            ny: [5, 11],
            nz: [2, -1]
          },
          {
            size: 5,
            px: [9, 4, 16, 14, 14],
            py: [8, 4, 23, 18, 18],
            pz: [1, 2, 0, 0, -1],
            nx: [0, 2, 1, 1, 0],
            ny: [2, 0, 3, 2, 3],
            nz: [1, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [17, 7, 7, 18, 19],
            py: [7, 11, 8, 7, 7],
            pz: [0, 1, 1, 0, 0],
            nx: [17, 5, 8, 2, 0],
            ny: [8, 0, 7, 5, 3],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [5, 14],
            py: [12, 3],
            pz: [0, -1],
            nx: [4, 3],
            ny: [5, 4],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [10, 8, 16, 11, 11],
            py: [5, 6, 12, 4, 4],
            pz: [0, 1, 0, 0, -1],
            nx: [14, 13, 5, 9, 5],
            ny: [13, 10, 1, 4, 2],
            nz: [0, 0, 2, 1, 2]
          },
          {
            size: 5,
            px: [15, 14, 16, 8, 8],
            py: [2, 2, 2, 0, 0],
            pz: [0, 0, 0, 1, -1],
            nx: [9, 18, 19, 18, 17],
            ny: [0, 0, 2, 1, 0],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [17, 15],
            py: [12, 11],
            pz: [0, 0],
            nx: [14, 4],
            ny: [9, 15],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [5, 11, 11],
            py: [3, 4, 5],
            pz: [2, 1, 1],
            nx: [14, 3, 18],
            ny: [6, 5, 0],
            nz: [0, 1, -1]
          },
          {
            size: 5,
            px: [16, 14, 17, 15, 9],
            py: [2, 2, 2, 2, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [21, 20, 11, 21, 21],
            ny: [2, 0, 7, 3, 3],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 5,
            px: [2, 1, 1, 1, 5],
            py: [12, 9, 7, 3, 6],
            pz: [0, 0, 1, 1, 1],
            nx: [4, 8, 3, 4, 17],
            ny: [4, 4, 0, 8, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [9, 2],
            ny: [4, 17],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 5],
            py: [16, 9],
            pz: [0, 1],
            nx: [10, 17],
            ny: [16, 8],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [11, 5, 9, 15],
            py: [14, 9, 11, 5],
            pz: [0, -1, -1, -1],
            nx: [10, 1, 9, 4],
            ny: [9, 2, 13, 7],
            nz: [0, 2, 0, 1]
          },
          {
            size: 5,
            px: [2, 5, 10, 7, 10],
            py: [7, 12, 2, 13, 3],
            pz: [1, -1, -1, -1, -1],
            nx: [5, 2, 3, 3, 2],
            ny: [23, 15, 17, 16, 14],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [11, 7],
            py: [8, 10],
            pz: [0, -1],
            nx: [7, 14],
            ny: [5, 8],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [9, 16],
            py: [7, 23],
            pz: [1, 0],
            nx: [4, 4],
            ny: [2, 1],
            nz: [2, -1]
          },
          {
            size: 5,
            px: [16, 14, 18, 4, 17],
            py: [0, 0, 4, 0, 1],
            pz: [0, 0, 0, 2, 0],
            nx: [8, 8, 16, 9, 9],
            ny: [5, 4, 11, 7, 7],
            nz: [1, 1, 0, 0, -1]
          },
          {
            size: 5,
            px: [12, 13, 7, 8, 4],
            py: [9, 12, 6, 11, 5],
            pz: [0, 0, 1, 1, 2],
            nx: [23, 23, 16, 9, 9],
            ny: [0, 1, 11, 7, 7],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [6, 7, 2],
            py: [21, 23, 4],
            pz: [0, 0, 2],
            nx: [4, 1, 16],
            ny: [10, 5, 11],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [3, 4],
            pz: [2, 2],
            nx: [3, 1],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [1, 2, 1, 0, 1],
            py: [7, 13, 12, 4, 13],
            pz: [0, 0, 0, 2, 0],
            nx: [18, 9, 9, 19, 19],
            ny: [23, 5, 11, 19, 19],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 3,
            px: [4, 10, 12],
            py: [6, 2, 5],
            pz: [1, -1, -1],
            nx: [10, 0, 0],
            ny: [12, 1, 3],
            nz: [0, 2, 2]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 0],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [19, 17, 10, 14, 18],
            py: [2, 1, 7, 0, 1],
            pz: [0, 0, 1, 0, 0],
            nx: [3, 3, 3, 7, 5],
            ny: [9, 10, 7, 23, 18],
            nz: [1, 1, 1, 0, 0]
          },
          {
            size: 2,
            px: [10, 10],
            py: [8, 7],
            pz: [1, 1],
            nx: [14, 4],
            ny: [15, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 15],
            py: [1, 3],
            pz: [1, 0],
            nx: [16, 19],
            ny: [1, 3],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [11, 11, 1, 2, 11],
            py: [11, 12, 1, 13, 12],
            pz: [0, 0, -1, -1, -1],
            nx: [12, 17, 8, 16, 8],
            ny: [7, 12, 11, 16, 6],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 5,
            px: [13, 11, 10, 12, 5],
            py: [0, 0, 0, 0, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [8, 4, 3, 4, 4],
            ny: [4, 5, 2, 4, 4],
            nz: [1, 1, 2, 1, -1]
          },
          {
            size: 5,
            px: [6, 1, 3, 2, 3],
            py: [13, 3, 3, 4, 10],
            pz: [0, 2, 1, 1, 1],
            nx: [0, 1, 0, 0, 0],
            ny: [2, 0, 5, 4, 4],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [15, 1],
            py: [4, 3],
            pz: [0, -1],
            nx: [16, 15],
            ny: [2, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 7],
            py: [7, 13],
            pz: [1, 0],
            nx: [3, 0],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [14, 15],
            py: [18, 14],
            pz: [0, -1],
            nx: [4, 14],
            ny: [4, 16],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [4, 6],
            py: [3, 4],
            pz: [2, 1],
            nx: [9, 5],
            ny: [14, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 6],
            py: [1, 5],
            pz: [0, -1],
            nx: [4, 9],
            ny: [0, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [9, 0],
            py: [4, 2],
            pz: [0, -1],
            nx: [5, 3],
            ny: [1, 0],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [1, 1, 1, 0, 0],
            py: [16, 15, 17, 6, 9],
            pz: [0, 0, 0, 1, 0],
            nx: [9, 5, 4, 9, 8],
            ny: [7, 3, 3, 6, 7],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 2,
            px: [9, 1],
            py: [8, 15],
            pz: [1, -1],
            nx: [9, 8],
            ny: [9, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [20, 19],
            py: [19, 22],
            pz: [0, 0],
            nx: [7, 0],
            ny: [3, 0],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [8, 4, 2, 5, 5],
            py: [12, 6, 3, 5, 5],
            pz: [0, 1, 2, 1, -1],
            nx: [22, 21, 20, 21, 22],
            ny: [17, 20, 22, 19, 16],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [6, 12],
            py: [2, 6],
            pz: [1, 0],
            nx: [8, 3],
            ny: [3, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [9, 4],
            pz: [1, 1],
            nx: [12, 4],
            ny: [17, 5],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [0, 1, 0],
            py: [5, 13, 3],
            pz: [2, 0, 2],
            nx: [0, 4, 11],
            ny: [23, 5, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [6, 3],
            pz: [0, 1],
            nx: [4, 4],
            ny: [3, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 5],
            py: [7, 3],
            pz: [0, -1],
            nx: [0, 1],
            ny: [4, 10],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [12, 13, 12, 12, 12],
            py: [12, 13, 11, 10, 10],
            pz: [0, 0, 0, 0, -1],
            nx: [10, 8, 8, 16, 15],
            ny: [7, 4, 10, 11, 10],
            nz: [0, 1, 0, 0, 0]
          },
          {
            size: 2,
            px: [4, 8],
            py: [3, 6],
            pz: [2, 1],
            nx: [4, 2],
            ny: [5, 5],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [9, 17],
            py: [17, 7],
            pz: [0, -1],
            nx: [5, 2],
            ny: [9, 4],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [4, 4],
            py: [3, 5],
            pz: [2, 2],
            nx: [12, 8],
            ny: [16, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [1, 1],
            py: [2, 0],
            pz: [1, 1],
            nx: [0, 4],
            ny: [0, 1],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [11, 1],
            py: [5, 0],
            pz: [0, -1],
            nx: [2, 3],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 4,
            px: [0, 6, 4, 22],
            py: [23, 2, 4, 12],
            pz: [0, -1, -1, -1],
            nx: [7, 6, 8, 5],
            ny: [1, 1, 2, 1],
            nz: [1, 1, 1, 1]
          },
          {
            size: 2,
            px: [4, 10],
            py: [0, 9],
            pz: [1, -1],
            nx: [2, 4],
            ny: [3, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [11, 8],
            py: [15, 13],
            pz: [0, -1],
            nx: [23, 11],
            ny: [13, 5],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [18, 4],
            py: [5, 4],
            pz: [0, -1],
            nx: [18, 20],
            ny: [4, 7],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [21, 20, 20, 10, 20],
            py: [17, 22, 19, 10, 21],
            pz: [0, 0, 0, 1, 0],
            nx: [5, 5, 3, 14, 7],
            ny: [9, 9, 0, 8, 4],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [3, 7, 13, 7, 3],
            py: [6, 12, 3, 0, 3],
            pz: [1, -1, -1, -1, -1],
            nx: [1, 5, 0, 0, 2],
            ny: [16, 6, 13, 5, 4],
            nz: [0, 1, 0, 1, 0]
          },
          {
            size: 2,
            px: [7, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [9, 5],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [14, 9, 13],
            py: [19, 22, 8],
            pz: [0, -1, -1],
            nx: [13, 4, 4],
            ny: [17, 2, 5],
            nz: [0, 2, 2]
          },
          {
            size: 2,
            px: [16, 4],
            py: [9, 3],
            pz: [0, 2],
            nx: [7, 4],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [10, 2, 4, 2],
            py: [23, 4, 8, 3],
            pz: [0, 2, 1, 2],
            nx: [14, 0, 4, 11],
            ny: [19, 3, 5, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 5,
            px: [9, 10, 8, 7, 11],
            py: [2, 2, 2, 2, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [6, 5, 3, 4, 4],
            ny: [0, 1, 0, 2, 2],
            nz: [0, 0, 1, 0, -1]
          },
          {
            size: 2,
            px: [6, 4],
            py: [13, 6],
            pz: [0, -1],
            nx: [15, 4],
            ny: [8, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [0, 8],
            py: [1, 2],
            pz: [2, -1],
            nx: [5, 4],
            ny: [2, 2],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [16, 13, 14, 15, 15],
            py: [1, 0, 0, 0, 0],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 9, 4, 18, 8],
            ny: [5, 9, 4, 18, 11],
            nz: [2, 1, 2, 0, 1]
          },
          {
            size: 2,
            px: [5, 6],
            py: [2, 6],
            pz: [2, 1],
            nx: [22, 9],
            ny: [23, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [19, 19],
            py: [5, 5],
            pz: [0, -1],
            nx: [21, 22],
            ny: [2, 4],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 5],
            py: [8, 6],
            pz: [0, 1],
            nx: [3, 4],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [18, 14],
            py: [13, 17],
            pz: [0, 0],
            nx: [14, 4],
            ny: [16, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 6],
            py: [6, 3],
            pz: [1, -1],
            nx: [1, 0],
            ny: [2, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [23, 21],
            py: [21, 14],
            pz: [0, -1],
            nx: [7, 5],
            ny: [0, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [15, 10],
            py: [23, 7],
            pz: [0, -1],
            nx: [9, 4],
            ny: [4, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [4, 18],
            py: [3, 8],
            pz: [2, 0],
            nx: [8, 4],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 7],
            py: [2, 11],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [2, 3, 5, 6, 1],
            py: [7, 14, 2, 2, 4],
            pz: [1, 0, 0, 0, 2],
            nx: [8, 4, 4, 7, 7],
            ny: [7, 5, 4, 9, 9],
            nz: [1, 2, 2, 1, -1]
          },
          {
            size: 2,
            px: [5, 3],
            py: [6, 3],
            pz: [1, -1],
            nx: [1, 2],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [7, 20, 4, 10, 10],
            py: [9, 16, 4, 10, 8],
            pz: [1, 0, 2, 1, 1],
            nx: [4, 2, 3, 5, 3],
            ny: [11, 5, 6, 12, 5],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 2,
            px: [6, 11],
            py: [4, 18],
            pz: [1, -1],
            nx: [8, 6],
            ny: [4, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [2, 8],
            py: [5, 23],
            pz: [2, 0],
            nx: [9, 4],
            ny: [0, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [3, 1, 2, 2, 2],
            py: [12, 6, 12, 11, 11],
            pz: [0, 1, 0, 0, -1],
            nx: [0, 0, 0, 0, 0],
            ny: [13, 12, 11, 14, 7],
            nz: [0, 0, 0, 0, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [1, 2],
            pz: [2, 1],
            nx: [8, 4],
            ny: [4, 14],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [11, 23, 23, 22, 22],
            py: [8, 12, 6, 13, 14],
            pz: [1, 0, 0, 0, 0],
            nx: [13, 8, 7, 6, 6],
            ny: [6, 3, 3, 9, 9],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 4,
            px: [9, 23, 23, 22],
            py: [7, 12, 6, 13],
            pz: [1, -1, -1, -1],
            nx: [11, 23, 23, 23],
            ny: [6, 13, 17, 10],
            nz: [1, 0, 0, 0]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [19, 5, 9, 16, 10],
            pz: [0, 2, 1, 0, 1],
            nx: [5, 2, 1, 2, 2],
            ny: [18, 10, 5, 9, 9],
            nz: [0, 1, 2, 1, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [10, 4],
            pz: [1, 2],
            nx: [23, 14],
            ny: [23, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 1],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 10],
            py: [4, 8],
            pz: [0, -1],
            nx: [8, 8],
            ny: [2, 3],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [7, 10, 11],
            py: [1, 6, 13],
            pz: [0, -1, -1],
            nx: [4, 4, 2],
            ny: [3, 8, 2],
            nz: [1, 1, 2]
          },
          {
            size: 2,
            px: [8, 4],
            py: [8, 2],
            pz: [1, 2],
            nx: [10, 5],
            ny: [10, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 16],
            py: [20, 21],
            pz: [0, -1],
            nx: [2, 4],
            ny: [5, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [3, 10],
            py: [7, 8],
            pz: [1, -1],
            nx: [7, 4],
            ny: [20, 7],
            nz: [0, 1]
          },
          {
            size: 5,
            px: [11, 11, 11, 11, 11],
            py: [10, 12, 13, 11, 11],
            pz: [0, 0, 0, 0, -1],
            nx: [11, 12, 16, 3, 8],
            ny: [6, 6, 10, 1, 8],
            nz: [0, 0, 0, 2, 0]
          },
          {
            size: 2,
            px: [12, 6],
            py: [4, 2],
            pz: [0, 1],
            nx: [7, 7],
            ny: [8, 1],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [23, 23, 23, 23, 23],
            py: [22, 20, 21, 19, 19],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 6, 3, 4, 3],
            ny: [19, 23, 15, 20, 16],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 3,
            px: [8, 4, 14],
            py: [12, 3, 8],
            pz: [0, -1, -1],
            nx: [4, 2, 10],
            ny: [10, 3, 13],
            nz: [1, 2, 0]
          },
          {
            size: 2,
            px: [11, 18],
            py: [13, 23],
            pz: [0, -1],
            nx: [5, 5],
            ny: [1, 2],
            nz: [2, 2]
          },
          {
            size: 3,
            px: [11, 2, 10],
            py: [17, 4, 17],
            pz: [0, 2, 0],
            nx: [11, 0, 22],
            ny: [15, 2, 4],
            nz: [0, -1, -1]
          },
          {
            size: 3,
            px: [11, 3, 0],
            py: [15, 4, 8],
            pz: [0, -1, -1],
            nx: [14, 11, 4],
            ny: [9, 17, 7],
            nz: [0, 0, 1]
          },
          {
            size: 2,
            px: [17, 16],
            py: [2, 1],
            pz: [0, 0],
            nx: [9, 11],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 4],
            py: [21, 23],
            pz: [0, 0],
            nx: [4, 0],
            ny: [3, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [18, 2],
            py: [20, 0],
            pz: [0, -1],
            nx: [4, 9],
            ny: [5, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [9, 1],
            py: [19, 3],
            pz: [0, -1],
            nx: [0, 0],
            ny: [9, 21],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [19, 19],
            py: [21, 22],
            pz: [0, 0],
            nx: [19, 0],
            ny: [23, 0],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [11, 2, 3, 2],
            py: [6, 6, 9, 4],
            pz: [0, -1, -1, -1],
            nx: [4, 9, 19, 19],
            ny: [5, 10, 17, 18],
            nz: [2, 1, 0, 0]
          },
          {
            size: 2,
            px: [2, 4],
            py: [4, 8],
            pz: [2, 1],
            nx: [4, 9],
            ny: [10, 10],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [23, 22],
            py: [8, 12],
            pz: [0, -1],
            nx: [7, 4],
            ny: [11, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [12, 1],
            py: [5, 2],
            pz: [0, -1],
            nx: [9, 11],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 4],
            py: [2, 2],
            pz: [0, -1],
            nx: [3, 2],
            ny: [1, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [17, 9],
            py: [13, 7],
            pz: [0, 1],
            nx: [9, 5],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [0, 0, 9, 13],
            py: [3, 3, 7, 3],
            pz: [2, -1, -1, -1],
            nx: [2, 4, 4, 11],
            ny: [1, 2, 8, 5],
            nz: [2, 1, 1, 0]
          },
          {
            size: 5,
            px: [3, 6, 5, 6, 6],
            py: [0, 0, 2, 1, 1],
            pz: [1, 0, 0, 0, -1],
            nx: [2, 2, 2, 1, 1],
            ny: [21, 19, 20, 16, 17],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [13, 3],
            py: [22, 10],
            pz: [0, -1],
            nx: [7, 4],
            ny: [10, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [3, 2],
            py: [7, 3],
            pz: [1, 2],
            nx: [8, 4],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [17, 8, 15, 7, 15],
            py: [13, 6, 16, 5, 12],
            pz: [0, 1, 0, 1, 0],
            nx: [5, 4, 6, 3, 4],
            ny: [1, 2, 1, 0, 3],
            nz: [0, 0, 0, 1, -1]
          },
          {
            size: 5,
            px: [12, 9, 11, 12, 10],
            py: [0, 1, 2, 2, 0],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 16, 7, 4, 4],
            ny: [9, 23, 9, 3, 2],
            nz: [1, 0, 1, 2, -1]
          },
          {
            size: 2,
            px: [4, 11],
            py: [1, 4],
            pz: [2, -1],
            nx: [8, 7],
            ny: [4, 4],
            nz: [0, 0]
          },
          {
            size: 4,
            px: [7, 4, 5, 8],
            py: [13, 2, 1, 3],
            pz: [0, -1, -1, -1],
            nx: [9, 4, 9, 9],
            ny: [9, 5, 10, 11],
            nz: [0, 1, 0, 0]
          },
          {
            size: 2,
            px: [10, 11],
            py: [10, 11],
            pz: [0, -1],
            nx: [2, 6],
            ny: [2, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [21, 3],
            py: [11, 2],
            pz: [0, -1],
            nx: [22, 22],
            ny: [20, 18],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [7, 6],
            py: [1, 2],
            pz: [0, 0],
            nx: [5, 10],
            ny: [1, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [21, 3],
            py: [18, 1],
            pz: [0, -1],
            nx: [16, 15],
            ny: [4, 4],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 7],
            py: [4, 1],
            pz: [0, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [13, 11],
            py: [23, 17],
            pz: [0, 0],
            nx: [11, 21],
            ny: [16, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [1, 2],
            py: [0, 6],
            pz: [1, -1],
            nx: [16, 16],
            ny: [9, 11],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 13],
            py: [20, 20],
            pz: [0, 0],
            nx: [11, 3],
            ny: [21, 7],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [19, 20, 9],
            py: [21, 18, 11],
            pz: [0, 0, 1],
            nx: [17, 4, 11],
            ny: [19, 2, 0],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [5, 2],
            pz: [0, 1],
            nx: [7, 9],
            ny: [7, 8],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [8, 4, 4, 8, 4],
            py: [4, 4, 5, 10, 3],
            pz: [1, 1, 2, 0, 2],
            nx: [11, 22, 11, 23, 23],
            ny: [0, 0, 1, 3, 3],
            nz: [1, 0, 1, 0, -1]
          },
          {
            size: 2,
            px: [8, 14],
            py: [10, 23],
            pz: [1, 0],
            nx: [7, 2],
            ny: [10, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 14],
            py: [6, 23],
            pz: [1, -1],
            nx: [1, 2],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [11, 2],
            py: [19, 3],
            pz: [0, -1],
            nx: [10, 12],
            ny: [18, 18],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 3],
            py: [4, 1],
            pz: [0, 2],
            nx: [6, 6],
            ny: [11, 11],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [18, 10, 20, 19, 19],
            pz: [0, 1, 0, 0, -1],
            nx: [11, 10, 14, 12, 13],
            ny: [2, 2, 2, 2, 2],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 3,
            px: [12, 2, 9],
            py: [14, 5, 10],
            pz: [0, -1, -1],
            nx: [11, 10, 5],
            ny: [10, 13, 5],
            nz: [0, 0, 1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [3, 7],
            pz: [2, 1],
            nx: [3, 10],
            ny: [4, 13],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 3],
            py: [21, 7],
            pz: [0, -1],
            nx: [10, 21],
            ny: [7, 15],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [21, 10],
            py: [16, 8],
            pz: [0, 1],
            nx: [8, 2],
            ny: [10, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 8],
            py: [6, 7],
            pz: [1, -1],
            nx: [12, 11],
            ny: [11, 7],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [3, 11],
            py: [4, 20],
            pz: [2, 0],
            nx: [11, 10],
            ny: [19, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [17, 5],
            py: [13, 3],
            pz: [0, -1],
            nx: [7, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [7, 1],
            py: [23, 3],
            pz: [0, 2],
            nx: [14, 6],
            ny: [12, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [11, 2],
            pz: [0, -1],
            nx: [11, 7],
            ny: [3, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [9, 6],
            py: [2, 17],
            pz: [0, -1],
            nx: [4, 6],
            ny: [4, 12],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [14, 19],
            py: [5, 6],
            pz: [0, -1],
            nx: [9, 3],
            ny: [9, 1],
            nz: [0, 2]
          },
          {
            size: 5,
            px: [12, 13, 13, 13, 12],
            py: [9, 11, 12, 13, 10],
            pz: [0, 0, 0, 0, 0],
            nx: [2, 4, 4, 4, 4],
            ny: [7, 18, 17, 14, 14],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [6, 6],
            pz: [1, -1],
            nx: [20, 18],
            ny: [18, 23],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 6],
            py: [4, 14],
            pz: [1, -1],
            nx: [9, 4],
            ny: [2, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [11, 9],
            py: [4, 18],
            pz: [0, -1],
            nx: [4, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [15, 0],
            py: [18, 4],
            pz: [0, -1],
            nx: [3, 4],
            ny: [5, 4],
            nz: [2, 2]
          },
          {
            size: 4,
            px: [7, 3, 6, 6],
            py: [8, 4, 6, 5],
            pz: [1, 2, 1, 1],
            nx: [10, 4, 13, 0],
            ny: [10, 4, 9, 22],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [10, 8],
            py: [18, 11],
            pz: [0, -1],
            nx: [5, 4],
            ny: [8, 10],
            nz: [1, 1]
          },
          {
            size: 4,
            px: [17, 2, 10, 2],
            py: [14, 1, 10, 3],
            pz: [0, -1, -1, -1],
            nx: [8, 8, 17, 8],
            ny: [4, 5, 12, 6],
            nz: [1, 1, 0, 1]
          },
          {
            size: 5,
            px: [9, 11, 9, 4, 10],
            py: [1, 1, 0, 0, 1],
            pz: [0, 0, 0, 1, 0],
            nx: [8, 4, 7, 15, 15],
            ny: [7, 2, 4, 17, 17],
            nz: [1, 2, 1, 0, -1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [11, 8],
            pz: [0, -1],
            nx: [2, 2],
            ny: [1, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [11, 3],
            py: [13, 8],
            pz: [0, -1],
            nx: [1, 1],
            ny: [5, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [6, 2],
            py: [8, 3],
            pz: [0, 2],
            nx: [3, 1],
            ny: [5, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [10, 5, 7, 8, 6],
            py: [9, 7, 7, 7, 7],
            pz: [0, 0, 0, 0, 0],
            nx: [7, 3, 0, 2, 15],
            ny: [8, 0, 1, 18, 17],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [17, 8],
            py: [12, 6],
            pz: [0, 1],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [3, 11, 8, 10, 12],
            py: [0, 2, 10, 2, 3],
            pz: [2, 0, 0, 0, 0],
            nx: [3, 2, 10, 2, 2],
            ny: [6, 4, 11, 3, 3],
            nz: [0, 1, 0, 1, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [2, 4],
            pz: [2, 1],
            nx: [8, 19],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [1, 1],
            pz: [2, -1],
            nx: [7, 17],
            ny: [1, 2],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [16, 15, 14, 13, 7],
            py: [0, 0, 0, 0, 0],
            pz: [0, 0, 0, 0, -1],
            nx: [6, 4, 8, 3, 11],
            ny: [3, 4, 4, 1, 6],
            nz: [1, 1, 1, 2, 0]
          },
          {
            size: 2,
            px: [11, 1],
            py: [8, 5],
            pz: [0, -1],
            nx: [13, 4],
            ny: [10, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [4, 9],
            py: [0, 2],
            pz: [2, 1],
            nx: [4, 11],
            ny: [0, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [15, 15],
            py: [2, 2],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [8, 17],
            py: [9, 22],
            pz: [1, 0],
            nx: [8, 20],
            ny: [10, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [14, 22],
            pz: [0, -1],
            nx: [3, 11],
            ny: [3, 3],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [4, 2],
            py: [1, 0],
            pz: [1, 2],
            nx: [5, 8],
            ny: [3, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [4, 8],
            pz: [2, 1],
            nx: [9, 5],
            ny: [15, 19],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [1, 1],
            pz: [0, 1],
            nx: [10, 10],
            ny: [6, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [17, 6],
            py: [10, 2],
            pz: [0, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 3,
            px: [13, 7, 3],
            py: [5, 2, 6],
            pz: [0, 1, -1],
            nx: [17, 16, 17],
            ny: [1, 1, 2],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [11, 10],
            py: [3, 3],
            pz: [0, 0],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [4, 8],
            py: [0, 8],
            pz: [2, -1],
            nx: [3, 4],
            ny: [0, 0],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [9, 2, 4, 1, 2],
            py: [13, 3, 9, 2, 5],
            pz: [0, 2, 1, 2, 2],
            nx: [9, 5, 10, 4, 10],
            ny: [5, 1, 3, 0, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [6, 12],
            py: [5, 9],
            pz: [1, 0],
            nx: [0, 2],
            ny: [23, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [22, 11],
            py: [21, 8],
            pz: [0, 1],
            nx: [10, 0],
            ny: [17, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 1],
            py: [22, 9],
            pz: [0, 1],
            nx: [22, 5],
            ny: [11, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [5, 6],
            ny: [10, 9],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [7, 3, 17, 7],
            py: [8, 2, 10, 11],
            pz: [0, 2, 0, 1],
            nx: [6, 10, 5, 23],
            ny: [9, 21, 1, 23],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [8, 3],
            py: [7, 2],
            pz: [1, 2],
            nx: [8, 9],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 5],
            py: [14, 6],
            pz: [0, 1],
            nx: [8, 8],
            ny: [13, 13],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [11, 6, 8],
            py: [20, 3, 20],
            pz: [0, -1, -1],
            nx: [5, 3, 12],
            ny: [9, 5, 18],
            nz: [1, 2, 0]
          },
          {
            size: 2,
            px: [3, 9],
            py: [1, 3],
            pz: [1, 0],
            nx: [2, 8],
            ny: [5, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [15, 9],
            py: [21, 3],
            pz: [0, -1],
            nx: [3, 4],
            ny: [5, 5],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [2, 9],
            py: [7, 11],
            pz: [1, -1],
            nx: [2, 2],
            ny: [8, 9],
            nz: [1, 1]
          },
          {
            size: 4,
            px: [3, 4, 3, 1],
            py: [14, 21, 19, 6],
            pz: [0, 0, 0, 1],
            nx: [10, 16, 4, 5],
            ny: [8, 1, 7, 6],
            nz: [0, -1, -1, -1]
          },
          {
            size: 4,
            px: [10, 4, 3, 1],
            py: [5, 21, 19, 6],
            pz: [1, -1, -1, -1],
            nx: [21, 10, 5, 11],
            ny: [4, 2, 3, 4],
            nz: [0, 1, 2, 1]
          },
          {
            size: 2,
            px: [4, 17],
            py: [3, 8],
            pz: [2, 0],
            nx: [17, 2],
            ny: [9, 22],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [17, 12],
            py: [14, 20],
            pz: [0, -1],
            nx: [7, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 12],
            py: [9, 20],
            pz: [0, -1],
            nx: [11, 23],
            ny: [8, 18],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [5, 11],
            py: [4, 7],
            pz: [2, 1],
            nx: [8, 15],
            ny: [7, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 15],
            py: [13, 8],
            pz: [0, -1],
            nx: [11, 11],
            ny: [6, 7],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 15],
            py: [14, 8],
            pz: [0, -1],
            nx: [4, 4],
            ny: [12, 13],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 5],
            py: [0, 1],
            pz: [2, 2],
            nx: [15, 4],
            ny: [5, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 17],
            py: [2, 2],
            pz: [0, 0],
            nx: [20, 8],
            ny: [3, 7],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [6, 3, 2],
            py: [10, 6, 1],
            pz: [0, -1, -1],
            nx: [4, 3, 2],
            ny: [3, 4, 2],
            nz: [1, 1, 2]
          },
          {
            size: 2,
            px: [10, 6],
            py: [4, 6],
            pz: [0, -1],
            nx: [6, 13],
            ny: [0, 1],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [10, 10],
            py: [8, 7],
            pz: [1, 1],
            nx: [8, 2],
            ny: [7, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 1],
            py: [12, 4],
            pz: [0, -1],
            nx: [3, 4],
            ny: [5, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [11, 15],
            py: [15, 14],
            pz: [0, -1],
            nx: [3, 11],
            ny: [4, 13],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [13, 9, 11, 14, 12],
            py: [0, 2, 0, 0, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [5, 4, 4, 3, 4],
            ny: [4, 4, 18, 7, 17],
            nz: [1, 1, 0, 1, 0]
          },
          {
            size: 3,
            px: [13, 12, 11],
            py: [22, 22, 22],
            pz: [0, 0, 0],
            nx: [11, 12, 13],
            ny: [20, 20, 20],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [6, 13],
            py: [2, 4],
            pz: [1, 0],
            nx: [7, 6],
            ny: [8, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [23, 4],
            pz: [0, -1],
            nx: [5, 9],
            ny: [1, 1],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [14, 14],
            py: [19, 19],
            pz: [0, -1],
            nx: [11, 11],
            ny: [10, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [23, 23],
            py: [11, 9],
            pz: [0, 0],
            nx: [23, 23],
            ny: [0, 11],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [23, 3],
            py: [23, 5],
            pz: [0, -1],
            nx: [4, 1],
            ny: [23, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [9, 1],
            py: [7, 4],
            pz: [1, -1],
            nx: [19, 10],
            ny: [20, 9],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [16, 1],
            py: [9, 4],
            pz: [0, -1],
            nx: [7, 8],
            ny: [3, 3],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [7, 6],
            py: [13, 13],
            pz: [0, 0],
            nx: [4, 5],
            ny: [4, 11],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [19, 20, 20, 10, 10],
            py: [0, 0, 2, 0, 1],
            pz: [0, 0, 0, 1, 1],
            nx: [7, 7, 15, 4, 4],
            ny: [4, 13, 7, 4, 4],
            nz: [1, 0, 0, 1, -1]
          },
          {
            size: 2,
            px: [12, 23],
            py: [6, 5],
            pz: [0, -1],
            nx: [18, 18],
            ny: [17, 16],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [6, 3],
            py: [9, 2],
            pz: [1, 2],
            nx: [14, 18],
            ny: [9, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 13],
            py: [16, 5],
            pz: [0, -1],
            nx: [5, 4],
            ny: [7, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [8, 10],
            pz: [1, 1],
            nx: [4, 1],
            ny: [5, 3],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [12, 11],
            py: [13, 4],
            pz: [0, -1],
            nx: [0, 0],
            ny: [14, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 1],
            py: [20, 17],
            pz: [0, 0],
            nx: [12, 12],
            ny: [22, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [6, 7],
            pz: [1, -1],
            nx: [21, 21],
            ny: [13, 12],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 10],
            py: [4, 23],
            pz: [2, 0],
            nx: [10, 2],
            ny: [21, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 12],
            py: [3, 6],
            pz: [1, 0],
            nx: [11, 0],
            ny: [17, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 4],
            py: [21, 9],
            pz: [0, -1],
            nx: [2, 3],
            ny: [18, 22],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [13, 5],
            py: [18, 9],
            pz: [0, -1],
            nx: [6, 7],
            ny: [8, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [21, 4],
            py: [16, 3],
            pz: [0, -1],
            nx: [23, 23],
            ny: [16, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 0],
            py: [7, 4],
            pz: [1, -1],
            nx: [3, 8],
            ny: [7, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [15, 16],
            py: [11, 12],
            pz: [0, 0],
            nx: [8, 5],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [7, 5],
            pz: [0, 0],
            nx: [17, 17],
            ny: [11, 10],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [8, 13, 12, 3, 3],
            py: [6, 23, 23, 3, 3],
            pz: [1, 0, 0, 2, -1],
            nx: [0, 1, 0, 0, 0],
            ny: [2, 13, 4, 5, 6],
            nz: [2, 0, 1, 1, 1]
          },
          {
            size: 2,
            px: [0, 1],
            py: [7, 8],
            pz: [1, -1],
            nx: [0, 0],
            ny: [1, 0],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [2, 12],
            py: [1, 7],
            pz: [1, -1],
            nx: [0, 0],
            ny: [12, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 1],
            py: [7, 4],
            pz: [1, 2],
            nx: [8, 0],
            ny: [15, 14],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 4],
            py: [14, 8],
            pz: [0, -1],
            nx: [2, 4],
            ny: [1, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [5, 3],
            py: [3, 1],
            pz: [2, -1],
            nx: [9, 9],
            ny: [5, 6],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [4, 5],
            py: [2, 3],
            pz: [1, -1],
            nx: [11, 12],
            ny: [23, 23],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [10, 5],
            py: [7, 0],
            pz: [1, -1],
            nx: [22, 22],
            ny: [19, 18],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [10, 2, 9],
            py: [20, 9, 4],
            pz: [0, -1, -1],
            nx: [1, 10, 11],
            ny: [2, 11, 9],
            nz: [2, 0, 0]
          },
          {
            size: 2,
            px: [4, 8],
            py: [3, 6],
            pz: [2, 1],
            nx: [9, 3],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 6],
            py: [7, 16],
            pz: [0, -1],
            nx: [17, 17],
            ny: [9, 6],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [8, 1, 9],
            py: [6, 3, 4],
            pz: [1, -1, -1],
            nx: [2, 9, 2],
            ny: [5, 13, 3],
            nz: [2, 0, 2]
          },
          {
            size: 4,
            px: [10, 10, 9, 2],
            py: [12, 11, 2, 10],
            pz: [0, 0, -1, -1],
            nx: [6, 11, 3, 13],
            ny: [2, 4, 1, 4],
            nz: [1, 0, 2, 0]
          },
          {
            size: 2,
            px: [3, 3],
            py: [7, 1],
            pz: [1, -1],
            nx: [4, 3],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [4, 8],
            pz: [2, 1],
            nx: [4, 4],
            ny: [15, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 0],
            py: [4, 8],
            pz: [1, -1],
            nx: [13, 13],
            ny: [9, 10],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [6, 3],
            py: [2, 1],
            pz: [1, 2],
            nx: [8, 17],
            ny: [4, 12],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [15, 16],
            py: [11, 6],
            pz: [0, 0],
            nx: [16, 17],
            ny: [5, 12],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 11],
            py: [9, 7],
            pz: [0, -1],
            nx: [0, 1],
            ny: [9, 20],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [16, 11, 20],
            py: [4, 7, 23],
            pz: [0, -1, -1],
            nx: [8, 9, 4],
            ny: [4, 6, 4],
            nz: [1, 1, 2]
          },
          {
            size: 2,
            px: [1, 1],
            py: [18, 17],
            pz: [0, 0],
            nx: [9, 6],
            ny: [7, 11],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [4, 4, 19],
            py: [3, 2, 9],
            pz: [2, 2, 0],
            nx: [2, 14, 11],
            ny: [5, 3, 9],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [11, 19],
            py: [13, 9],
            pz: [0, -1],
            nx: [11, 11],
            ny: [4, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [13, 7],
            py: [19, 2],
            pz: [0, -1],
            nx: [3, 5],
            ny: [6, 12],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [9, 4, 4, 2],
            py: [13, 9, 8, 4],
            pz: [0, 1, 1, 2],
            nx: [13, 0, 0, 14],
            ny: [18, 11, 6, 1],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 15],
            py: [8, 10],
            pz: [0, 0],
            nx: [14, 11],
            ny: [9, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 2],
            py: [8, 5],
            pz: [1, 2],
            nx: [4, 4],
            ny: [10, 10],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [4, 6, 16, 14],
            py: [1, 1, 1, 7],
            pz: [2, 1, 0, 0],
            nx: [10, 1, 1, 2],
            ny: [8, 5, 10, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 4,
            px: [2, 3, 1, 2],
            py: [3, 1, 0, 2],
            pz: [0, 0, 1, 0],
            nx: [0, 0, 0, 0],
            ny: [1, 1, 2, 0],
            nz: [0, 1, 0, 1]
          },
          {
            size: 2,
            px: [8, 8],
            py: [6, 7],
            pz: [1, 1],
            nx: [8, 0],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [3, 0],
            pz: [0, 1],
            nx: [2, 2],
            ny: [1, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 6],
            py: [19, 18],
            pz: [0, 0],
            nx: [2, 10],
            ny: [5, 8],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [8, 5],
            py: [21, 11],
            pz: [0, -1],
            nx: [3, 2],
            ny: [11, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [4, 9],
            py: [4, 7],
            pz: [2, 1],
            nx: [8, 7],
            ny: [10, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [4, 18, 19, 16, 19],
            py: [3, 12, 12, 23, 13],
            pz: [2, 0, 0, 0, 0],
            nx: [2, 8, 3, 2, 2],
            ny: [4, 23, 10, 5, 5],
            nz: [2, 0, 1, 2, -1]
          },
          {
            size: 2,
            px: [4, 8],
            py: [6, 11],
            pz: [1, 0],
            nx: [8, 3],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 12],
            py: [4, 13],
            pz: [2, 0],
            nx: [10, 5],
            ny: [15, 21],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 9],
            py: [4, 23],
            pz: [2, 0],
            nx: [19, 4],
            ny: [9, 3],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [3, 6],
            py: [8, 15],
            pz: [1, 0],
            nx: [6, 1],
            ny: [18, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 0],
            py: [20, 3],
            pz: [0, -1],
            nx: [2, 10],
            ny: [5, 17],
            nz: [2, 0]
          },
          {
            size: 3,
            px: [10, 6, 3],
            py: [2, 7, 3],
            pz: [0, -1, -1],
            nx: [5, 4, 2],
            ny: [9, 7, 2],
            nz: [1, 1, 2]
          },
          {
            size: 2,
            px: [14, 6],
            py: [12, 7],
            pz: [0, -1],
            nx: [2, 10],
            ny: [0, 1],
            nz: [2, 0]
          },
          {
            size: 3,
            px: [10, 5, 1],
            py: [15, 5, 4],
            pz: [0, -1, -1],
            nx: [9, 4, 18],
            ny: [2, 0, 4],
            nz: [1, 2, 0]
          },
          {
            size: 2,
            px: [17, 2],
            py: [12, 6],
            pz: [0, -1],
            nx: [8, 16],
            ny: [4, 11],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [7, 13, 4],
            py: [0, 0, 1],
            pz: [1, 0, -1],
            nx: [18, 4, 4],
            ny: [13, 2, 3],
            nz: [0, 2, 2]
          },
          {
            size: 2,
            px: [1, 11],
            py: [10, 6],
            pz: [0, -1],
            nx: [0, 1],
            ny: [15, 17],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [9, 12, 8],
            py: [8, 17, 11],
            pz: [1, 0, 1],
            nx: [12, 0, 20],
            ny: [16, 9, 13],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [11, 4],
            py: [5, 8],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [16, 3],
            py: [9, 8],
            pz: [0, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [11, 5],
            pz: [1, 2],
            nx: [11, 5],
            ny: [21, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 13],
            py: [1, 1],
            pz: [0, 0],
            nx: [4, 4],
            ny: [5, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [14, 4],
            py: [4, 3],
            pz: [0, -1],
            nx: [12, 10],
            ny: [2, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 6],
            py: [2, 4],
            pz: [2, 1],
            nx: [9, 7],
            ny: [9, 7],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [5, 6, 6],
            py: [4, 4, 4],
            pz: [1, -1, -1],
            nx: [13, 8, 7],
            ny: [8, 3, 4],
            nz: [0, 1, 1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [2, 11],
            pz: [1, 1],
            nx: [10, 11],
            ny: [22, 22],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [16, 9],
            py: [13, 7],
            pz: [0, 1],
            nx: [8, 14],
            ny: [4, 12],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 5],
            py: [13, 3],
            pz: [0, 2],
            nx: [16, 22],
            ny: [13, 6],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [4, 4, 3, 4],
            py: [4, 3, 4, 5],
            pz: [2, 2, 2, 2],
            nx: [21, 5, 17, 7],
            ny: [0, 2, 5, 23],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 16],
            py: [0, 1],
            pz: [2, 0],
            nx: [15, 1],
            ny: [23, 10],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 6],
            py: [11, 2],
            pz: [0, -1],
            nx: [15, 6],
            ny: [2, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [2, 1],
            pz: [1, 2],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [13, 14, 5],
            py: [9, 15, 2],
            pz: [0, -1, -1],
            nx: [11, 1, 11],
            ny: [10, 3, 11],
            nz: [0, 1, 0]
          },
          {
            size: 2,
            px: [5, 1],
            py: [6, 2],
            pz: [1, -1],
            nx: [1, 1],
            ny: [2, 5],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [1, 0],
            pz: [1, 2],
            nx: [10, 4],
            ny: [2, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [8, 9],
            pz: [1, 1],
            nx: [23, 4],
            ny: [23, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [10, 2],
            pz: [0, -1],
            nx: [18, 10],
            ny: [0, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [20, 4],
            py: [7, 3],
            pz: [0, 2],
            nx: [8, 4],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [5, 4],
            pz: [1, -1],
            nx: [11, 11],
            ny: [5, 6],
            nz: [1, 1]
          },
          {
            size: 3,
            px: [14, 15, 16],
            py: [0, 0, 1],
            pz: [0, 0, 0],
            nx: [8, 5, 15],
            ny: [7, 2, 10],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [1, 1],
            pz: [2, -1],
            nx: [17, 18],
            ny: [2, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [13, 8],
            py: [15, 7],
            pz: [0, -1],
            nx: [9, 4],
            ny: [5, 2],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [4, 0],
            py: [6, 17],
            pz: [1, -1],
            nx: [3, 2],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [14, 8],
            py: [17, 9],
            pz: [0, -1],
            nx: [7, 6],
            ny: [8, 8],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [7, 1],
            pz: [1, -1],
            nx: [15, 6],
            ny: [14, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [3, 12],
            py: [8, 19],
            pz: [1, 0],
            nx: [13, 10],
            ny: [17, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 12],
            py: [2, 4],
            pz: [1, 0],
            nx: [6, 11],
            ny: [3, 2],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [2, 1, 6, 1],
            py: [10, 3, 23, 8],
            pz: [1, 2, 0, 1],
            nx: [17, 10, 23, 0],
            ny: [9, 2, 20, 3],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [2, 8],
            pz: [0, -1],
            nx: [2, 2],
            ny: [4, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [3, 16],
            py: [1, 6],
            pz: [2, 0],
            nx: [8, 4],
            ny: [2, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [1, 2],
            pz: [2, 1],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 6],
            py: [3, 0],
            pz: [2, -1],
            nx: [9, 5],
            ny: [2, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [3, 16],
            py: [5, 23],
            pz: [1, -1],
            nx: [0, 0],
            ny: [6, 3],
            nz: [1, 2]
          },
          {
            size: 4,
            px: [0, 0, 0, 0],
            py: [3, 2, 12, 5],
            pz: [2, 2, 0, 1],
            nx: [2, 3, 2, 13],
            ny: [5, 5, 2, 19],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [10, 11],
            pz: [0, 0],
            nx: [5, 5],
            ny: [1, 1],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [0, 4],
            pz: [2, -1],
            nx: [2, 2],
            ny: [10, 8],
            nz: [1, 1]
          },
          {
            size: 4,
            px: [16, 2, 8, 4],
            py: [14, 0, 11, 5],
            pz: [0, -1, -1, -1],
            nx: [18, 14, 7, 7],
            ny: [13, 14, 8, 6],
            nz: [0, 0, 1, 1]
          },
          {
            size: 2,
            px: [8, 9],
            py: [2, 2],
            pz: [0, 0],
            nx: [5, 14],
            ny: [4, 14],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 5],
            py: [11, 20],
            pz: [1, 0],
            nx: [11, 4],
            ny: [0, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [3, 4],
            pz: [2, 2],
            nx: [3, 4],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [10, 4, 3],
            py: [5, 5, 3],
            pz: [0, -1, -1],
            nx: [11, 3, 10],
            ny: [2, 0, 2],
            nz: [0, 2, 0]
          },
          {
            size: 2,
            px: [15, 15],
            py: [1, 1],
            pz: [0, -1],
            nx: [7, 4],
            ny: [5, 2],
            nz: [1, 2]
          },
          {
            size: 4,
            px: [9, 5, 2, 6],
            py: [22, 8, 4, 19],
            pz: [0, 1, 2, 0],
            nx: [9, 5, 0, 3],
            ny: [20, 5, 22, 4],
            nz: [0, -1, -1, -1]
          },
          {
            size: 3,
            px: [1, 4, 10],
            py: [3, 9, 12],
            pz: [2, 1, 0],
            nx: [0, 10, 0],
            ny: [0, 5, 0],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [1, 6],
            py: [0, 7],
            pz: [0, -1],
            nx: [20, 19],
            ny: [14, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [13, 4],
            py: [14, 15],
            pz: [0, -1],
            nx: [2, 1],
            ny: [5, 7],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [17, 7],
            py: [9, 11],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [17, 9],
            py: [12, 6],
            pz: [0, 1],
            nx: [15, 10],
            ny: [9, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [0, 1],
            pz: [2, 2],
            nx: [9, 7],
            ny: [6, 17],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [3, 3, 15],
            py: [3, 4, 6],
            pz: [2, 1, 0],
            nx: [0, 2, 22],
            ny: [5, 8, 9],
            nz: [0, -1, -1]
          },
          {
            size: 4,
            px: [15, 15, 15, 1],
            py: [12, 6, 6, 1],
            pz: [0, -1, -1, -1],
            nx: [4, 7, 13, 4],
            ny: [4, 7, 12, 2],
            nz: [2, 1, 0, 2]
          },
          {
            size: 2,
            px: [3, 15],
            py: [12, 6],
            pz: [0, -1],
            nx: [9, 1],
            ny: [14, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [12, 12],
            py: [11, 12],
            pz: [0, 0],
            nx: [9, 5],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [23, 6, 7],
            py: [23, 3, 4],
            pz: [0, -1, -1],
            nx: [19, 16, 17],
            ny: [17, 14, 15],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [9, 5],
            py: [2, 7],
            pz: [1, -1],
            nx: [11, 23],
            ny: [10, 18],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [0, 0, 0],
            py: [4, 9, 2],
            pz: [1, 0, 2],
            nx: [2, 0, 0],
            ny: [9, 2, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [12, 0],
            py: [11, 9],
            pz: [0, -1],
            nx: [1, 0],
            ny: [18, 5],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [5, 4],
            py: [10, 6],
            pz: [0, 1],
            nx: [10, 6],
            ny: [10, 18],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 12],
            py: [13, 13],
            pz: [0, -1],
            nx: [5, 11],
            ny: [1, 3],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [10, 19],
            py: [5, 22],
            pz: [1, -1],
            nx: [4, 12],
            ny: [1, 5],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [8, 6],
            py: [0, 0],
            pz: [0, 0],
            nx: [3, 12],
            ny: [0, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 6],
            py: [7, 0],
            pz: [1, -1],
            nx: [12, 12],
            ny: [10, 11],
            nz: [0, 0]
          },
          {
            size: 4,
            px: [3, 1, 3, 2],
            py: [20, 9, 21, 19],
            pz: [0, 1, 0, 0],
            nx: [20, 20, 5, 12],
            ny: [10, 15, 2, 10],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 1],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [5, 11, 11],
            py: [1, 3, 4],
            pz: [2, 1, 1],
            nx: [3, 3, 7],
            ny: [5, 5, 0],
            nz: [1, -1, -1]
          },
          {
            size: 3,
            px: [8, 6, 7],
            py: [10, 5, 6],
            pz: [1, 1, 1],
            nx: [23, 3, 7],
            ny: [0, 5, 0],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [2, 7],
            py: [2, 14],
            pz: [1, -1],
            nx: [7, 3],
            ny: [12, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [5, 3],
            py: [6, 3],
            pz: [1, 2],
            nx: [13, 3],
            ny: [12, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 18],
            py: [11, 4],
            pz: [0, -1],
            nx: [23, 11],
            ny: [19, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [7, 2],
            py: [12, 3],
            pz: [0, -1],
            nx: [8, 4],
            ny: [11, 5],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [0, 11],
            pz: [1, -1],
            nx: [3, 3],
            ny: [19, 18],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [11, 1],
            py: [11, 11],
            pz: [1, -1],
            nx: [13, 15],
            ny: [6, 5],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 8],
            py: [9, 9],
            pz: [0, -1],
            nx: [5, 11],
            ny: [1, 3],
            nz: [2, 1]
          },
          {
            size: 4,
            px: [6, 4, 8, 3],
            py: [6, 2, 4, 3],
            pz: [0, 2, 1, 2],
            nx: [7, 0, 15, 8],
            ny: [8, 8, 16, 7],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [22, 20],
            pz: [0, 0],
            nx: [2, 8],
            ny: [5, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [12, 6],
            py: [11, 0],
            pz: [0, -1],
            nx: [0, 0],
            ny: [3, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [0, 0],
            py: [12, 7],
            pz: [0, 1],
            nx: [3, 1],
            ny: [23, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 0],
            py: [11, 5],
            pz: [1, -1],
            nx: [0, 0],
            ny: [2, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [8, 8],
            py: [10, 10],
            pz: [0, -1],
            nx: [4, 3],
            ny: [5, 4],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [13, 3],
            py: [2, 4],
            pz: [0, -1],
            nx: [4, 3],
            ny: [3, 5],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [1, 1],
            py: [23, 22],
            pz: [0, 0],
            nx: [9, 0],
            ny: [7, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [1, 0],
            py: [16, 15],
            pz: [0, 0],
            nx: [0, 14],
            ny: [23, 12],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 8],
            py: [22, 0],
            pz: [0, -1],
            nx: [5, 3],
            ny: [0, 1],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [13, 13],
            py: [7, 7],
            pz: [0, -1],
            nx: [3, 2],
            ny: [17, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [20, 20],
            py: [15, 16],
            pz: [0, 0],
            nx: [7, 3],
            ny: [9, 17],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [10, 12, 11, 13, 11],
            py: [2, 2, 1, 2, 2],
            pz: [0, 0, 0, 0, 0],
            nx: [10, 18, 21, 21, 19],
            ny: [3, 1, 13, 11, 2],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [16, 3],
            py: [6, 1],
            pz: [0, 2],
            nx: [15, 18],
            ny: [8, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [19, 3],
            py: [8, 1],
            pz: [0, -1],
            nx: [9, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 3],
            py: [15, 18],
            pz: [0, -1],
            nx: [3, 3],
            ny: [0, 1],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [3, 3],
            py: [2, 3],
            pz: [2, 2],
            nx: [7, 3],
            ny: [11, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 10],
            py: [17, 9],
            pz: [0, -1],
            nx: [11, 10],
            ny: [15, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 10],
            py: [2, 4],
            pz: [1, 0],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 10],
            py: [3, 4],
            pz: [0, -1],
            nx: [9, 10],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [23, 11],
            py: [13, 10],
            pz: [0, 1],
            nx: [14, 7],
            ny: [5, 14],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 4],
            py: [5, 4],
            pz: [2, 2],
            nx: [9, 8],
            ny: [3, 3],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [12, 4, 15],
            py: [5, 4, 7],
            pz: [0, -1, -1],
            nx: [3, 4, 2],
            ny: [7, 11, 5],
            nz: [1, 1, 2]
          },
          {
            size: 2,
            px: [11, 4],
            py: [15, 4],
            pz: [0, -1],
            nx: [5, 9],
            ny: [7, 15],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [9, 7],
            py: [0, 1],
            pz: [1, -1],
            nx: [11, 11],
            ny: [8, 7],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [1, 1, 1, 1, 1],
            py: [11, 12, 10, 9, 9],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 5, 8, 16, 11],
            ny: [4, 3, 8, 8, 6],
            nz: [1, 1, 0, 0, 0]
          }
        ],
        alpha: [
          -1.059083,
          1.059083,
          -7.846122e-1,
          7.846122e-1,
          -4.45116e-1,
          4.45116e-1,
          -4.483277e-1,
          4.483277e-1,
          -3.905999e-1,
          3.905999e-1,
          -3.78925e-1,
          3.78925e-1,
          -3.87461e-1,
          3.87461e-1,
          -3.110541e-1,
          3.110541e-1,
          -3.565056e-1,
          3.565056e-1,
          -3.812617e-1,
          3.812617e-1,
          -3.325142e-1,
          3.325142e-1,
          -2.787282e-1,
          2.787282e-1,
          -3.238869e-1,
          3.238869e-1,
          -2.993499e-1,
          2.993499e-1,
          -2.807737e-1,
          2.807737e-1,
          -2.855285e-1,
          2.855285e-1,
          -2.27755e-1,
          2.27755e-1,
          -2.031261e-1,
          2.031261e-1,
          -2.071574e-1,
          2.071574e-1,
          -2.534142e-1,
          2.534142e-1,
          -2.266871e-1,
          2.266871e-1,
          -2.229078e-1,
          2.229078e-1,
          -2.716325e-1,
          2.716325e-1,
          -3.046938e-1,
          3.046938e-1,
          -2.271601e-1,
          2.271601e-1,
          -1.987651e-1,
          1.987651e-1,
          -1.953664e-1,
          1.953664e-1,
          -2.178737e-1,
          2.178737e-1,
          -2.285148e-1,
          2.285148e-1,
          -1.891073e-1,
          1.891073e-1,
          -2.926469e-1,
          2.926469e-1,
          -2.094783e-1,
          2.094783e-1,
          -1.478037e-1,
          1.478037e-1,
          -1.707579e-1,
          1.707579e-1,
          -1.46439e-1,
          1.46439e-1,
          -2.462321e-1,
          2.462321e-1,
          -2.319978e-1,
          2.319978e-1,
          -1.781651e-1,
          1.781651e-1,
          -1.471349e-1,
          1.471349e-1,
          -1.953006e-1,
          1.953006e-1,
          -2.145108e-1,
          2.145108e-1,
          -1.567881e-1,
          1.567881e-1,
          -2.024617e-1,
          2.024617e-1,
          -1.883198e-1,
          1.883198e-1,
          -1.996976e-1,
          1.996976e-1,
          -1.29233e-1,
          1.29233e-1,
          -2.142242e-1,
          2.142242e-1,
          -2.473748e-1,
          2.473748e-1,
          -1.880902e-1,
          1.880902e-1,
          -1.874572e-1,
          1.874572e-1,
          -1.495984e-1,
          1.495984e-1,
          -1.608525e-1,
          1.608525e-1,
          -1.698402e-1,
          1.698402e-1,
          -1.898871e-1,
          1.898871e-1,
          -1.350238e-1,
          1.350238e-1,
          -1.727032e-1,
          1.727032e-1,
          -1.593352e-1,
          1.593352e-1,
          -1.476968e-1,
          1.476968e-1,
          -1.428431e-1,
          1.428431e-1,
          -1.766261e-1,
          1.766261e-1,
          -1.453226e-1,
          1.453226e-1,
          -1.929885e-1,
          1.929885e-1,
          -1.337582e-1,
          1.337582e-1,
          -1.629078e-1,
          1.629078e-1,
          -9.973085e-2,
          9.973085e-2,
          -1.17276e-1,
          1.17276e-1,
          -1.399242e-1,
          1.399242e-1,
          -1.613189e-1,
          1.613189e-1,
          -1.145695e-1,
          1.145695e-1,
          -1.191093e-1,
          1.191093e-1,
          -1.2259e-1,
          1.2259e-1,
          -1.641114e-1,
          1.641114e-1,
          -1.419878e-1,
          1.419878e-1,
          -2.183465e-1,
          2.183465e-1,
          -1.566968e-1,
          1.566968e-1,
          -1.288216e-1,
          1.288216e-1,
          -1.422831e-1,
          1.422831e-1,
          -2.000107e-1,
          2.000107e-1,
          -1.817265e-1,
          1.817265e-1,
          -1.793796e-1,
          1.793796e-1,
          -1.428926e-1,
          1.428926e-1,
          -1.182032e-1,
          1.182032e-1,
          -1.150421e-1,
          1.150421e-1,
          -1.336584e-1,
          1.336584e-1,
          -1.656178e-1,
          1.656178e-1,
          -1.386549e-1,
          1.386549e-1,
          -1.387461e-1,
          1.387461e-1,
          -1.313023e-1,
          1.313023e-1,
          -1.360391e-1,
          1.360391e-1,
          -1.305505e-1,
          1.305505e-1,
          -1.323399e-1,
          1.323399e-1,
          -1.502891e-1,
          1.502891e-1,
          -1.488859e-1,
          1.488859e-1,
          -1.126628e-1,
          1.126628e-1,
          -1.233623e-1,
          1.233623e-1,
          -1.702106e-1,
          1.702106e-1,
          -1.629639e-1,
          1.629639e-1,
          -1.337706e-1,
          1.337706e-1,
          -1.290384e-1,
          1.290384e-1,
          -1.165519e-1,
          1.165519e-1,
          -1.412778e-1,
          1.412778e-1,
          -1.470204e-1,
          1.470204e-1,
          -2.21378e-1,
          2.21378e-1,
          -1.472619e-1,
          1.472619e-1,
          -1.357071e-1,
          1.357071e-1,
          -1.416513e-1,
          1.416513e-1,
          -1.050208e-1,
          1.050208e-1,
          -1.480033e-1,
          1.480033e-1,
          -1.899871e-1,
          1.899871e-1,
          -1.466249e-1,
          1.466249e-1,
          -1.076952e-1,
          1.076952e-1,
          -1.035096e-1,
          1.035096e-1,
          -1.56697e-1,
          1.56697e-1,
          -1.364115e-1,
          1.364115e-1,
          -1.512889e-1,
          1.512889e-1,
          -1.252851e-1,
          1.252851e-1,
          -1.2063e-1,
          1.2063e-1,
          -1.059134e-1,
          1.059134e-1,
          -1.140398e-1,
          1.140398e-1,
          -1.359912e-1,
          1.359912e-1,
          -1.231201e-1,
          1.231201e-1,
          -1.231867e-1,
          1.231867e-1,
          -9.789923e-2,
          9.789923e-2,
          -1.590213e-1,
          1.590213e-1,
          -1.002206e-1,
          1.002206e-1,
          -1.518339e-1,
          1.518339e-1,
          -1.055203e-1,
          1.055203e-1,
          -1.012579e-1,
          1.012579e-1,
          -1.094956e-1,
          1.094956e-1,
          -1.429592e-1,
          1.429592e-1,
          -1.108838e-1,
          1.108838e-1,
          -1.116475e-1,
          1.116475e-1,
          -1.735371e-1,
          1.735371e-1,
          -1.067758e-1,
          1.067758e-1,
          -1.290406e-1,
          1.290406e-1,
          -1.156822e-1,
          1.156822e-1,
          -9.668217e-2,
          9.668217e-2,
          -1.170053e-1,
          1.170053e-1,
          -1.252092e-1,
          1.252092e-1,
          -1.135158e-1,
          1.135158e-1,
          -1.105896e-1,
          1.105896e-1,
          -1.038175e-1,
          1.038175e-1,
          -1.210459e-1,
          1.210459e-1,
          -1.078878e-1,
          1.078878e-1,
          -1.050808e-1,
          1.050808e-1,
          -1.428227e-1,
          1.428227e-1,
          -1.6646e-1,
          1.6646e-1,
          -1.013508e-1,
          1.013508e-1,
          -1.20693e-1,
          1.20693e-1,
          -1.088972e-1,
          1.088972e-1,
          -1.381026e-1,
          1.381026e-1,
          -1.109115e-1,
          1.109115e-1,
          -7.921549e-2,
          7.921549e-2,
          -1.057832e-1,
          1.057832e-1,
          -9.385827e-2,
          9.385827e-2,
          -1.486035e-1,
          1.486035e-1,
          -1.247401e-1,
          1.247401e-1,
          -9.451327e-2,
          9.451327e-2,
          -1.272805e-1,
          1.272805e-1,
          -9.616206e-2,
          9.616206e-2,
          -9.051084e-2,
          9.051084e-2,
          -1.138458e-1,
          1.138458e-1,
          -1.047581e-1,
          1.047581e-1,
          -1.382394e-1,
          1.382394e-1,
          -1.122203e-1,
          1.122203e-1,
          -1.052936e-1,
          1.052936e-1,
          -1.239318e-1,
          1.239318e-1,
          -1.241439e-1,
          1.241439e-1,
          -1.259012e-1,
          1.259012e-1,
          -1.211701e-1,
          1.211701e-1,
          -1.344131e-1,
          1.344131e-1,
          -1.127778e-1,
          1.127778e-1,
          -1.609745e-1,
          1.609745e-1,
          -1.901382e-1,
          1.901382e-1,
          -1.618962e-1,
          1.618962e-1,
          -1.230398e-1,
          1.230398e-1,
          -1.319311e-1,
          1.319311e-1,
          -1.43141e-1,
          1.43141e-1,
          -1.143306e-1,
          1.143306e-1,
          -9.390938e-2,
          9.390938e-2,
          -1.154161e-1,
          1.154161e-1,
          -1.141205e-1,
          1.141205e-1,
          -1.098048e-1,
          1.098048e-1,
          -8.870072e-2,
          8.870072e-2,
          -1.122444e-1,
          1.122444e-1,
          -1.114147e-1,
          1.114147e-1,
          -1.18571e-1,
          1.18571e-1,
          -1.107775e-1,
          1.107775e-1,
          -1.259167e-1,
          1.259167e-1,
          -1.105176e-1,
          1.105176e-1,
          -1.020691e-1,
          1.020691e-1,
          -9.607863e-2,
          9.607863e-2,
          -9.5737e-2,
          9.5737e-2,
          -1.054349e-1,
          1.054349e-1,
          -1.137856e-1,
          1.137856e-1,
          -1.192043e-1,
          1.192043e-1,
          -1.113264e-1,
          1.113264e-1,
          -1.093137e-1,
          1.093137e-1,
          -1.010919e-1,
          1.010919e-1,
          -9.625901e-2,
          9.625901e-2,
          -9.338459e-2,
          9.338459e-2,
          -1.142944e-1,
          1.142944e-1,
          -1.038877e-1,
          1.038877e-1,
          -9.772862e-2,
          9.772862e-2,
          -1.375298e-1,
          1.375298e-1,
          -1.394776e-1,
          1.394776e-1,
          -9.454765e-2,
          9.454765e-2,
          -1.203246e-1,
          1.203246e-1,
          -8.684943e-2,
          8.684943e-2,
          -1.135622e-1,
          1.135622e-1,
          -1.058181e-1,
          1.058181e-1,
          -1.082152e-1,
          1.082152e-1,
          -1.411355e-1,
          1.411355e-1,
          -9.978846e-2,
          9.978846e-2,
          -1.057874e-1,
          1.057874e-1,
          -1.415366e-1,
          1.415366e-1,
          -9.981014e-2,
          9.981014e-2,
          -9.261151e-2,
          9.261151e-2,
          -1.737173e-1,
          1.737173e-1,
          -1.580335e-1,
          1.580335e-1,
          -9.594668e-2,
          9.594668e-2,
          -9.336013e-2,
          9.336013e-2,
          -1.102373e-1,
          1.102373e-1,
          -8.546557e-2,
          8.546557e-2,
          -9.945057e-2,
          9.945057e-2,
          -1.146358e-1,
          1.146358e-1,
          -1.324734e-1,
          1.324734e-1,
          -1.422296e-1,
          1.422296e-1,
          -9.93799e-2,
          9.93799e-2,
          -8.381049e-2,
          8.381049e-2,
          -1.270714e-1,
          1.270714e-1,
          -1.091738e-1,
          1.091738e-1,
          -1.314881e-1,
          1.314881e-1,
          -1.085159e-1,
          1.085159e-1,
          -9.247554e-2,
          9.247554e-2,
          -8.121645e-2,
          8.121645e-2,
          -1.059589e-1,
          1.059589e-1,
          -8.307793e-2,
          8.307793e-2,
          -1.033103e-1,
          1.033103e-1,
          -1.056706e-1,
          1.056706e-1,
          -1.032803e-1,
          1.032803e-1,
          -1.26684e-1,
          1.26684e-1,
          -9.341601e-2,
          9.341601e-2,
          -7.68357e-2,
          7.68357e-2,
          -1.03053e-1,
          1.03053e-1,
          -1.051872e-1,
          1.051872e-1,
          -9.114946e-2,
          9.114946e-2,
          -1.329341e-1,
          1.329341e-1,
          -9.27083e-2,
          9.27083e-2,
          -1.14175e-1,
          1.14175e-1,
          -9.889318e-2,
          9.889318e-2,
          -8.856485e-2,
          8.856485e-2,
          -1.05421e-1,
          1.05421e-1,
          -1.092704e-1,
          1.092704e-1,
          -8.729085e-2,
          8.729085e-2,
          -1.141057e-1,
          1.141057e-1,
          -1.530774e-1,
          1.530774e-1,
          -8.12972e-2,
          8.12972e-2,
          -1.143335e-1,
          1.143335e-1,
          -1.175777e-1,
          1.175777e-1,
          -1.371729e-1,
          1.371729e-1,
          -1.394356e-1,
          1.394356e-1,
          -1.016308e-1,
          1.016308e-1,
          -1.125547e-1,
          1.125547e-1,
          -9.6726e-2,
          9.6726e-2,
          -1.036631e-1,
          1.036631e-1,
          -8.702514e-2,
          8.702514e-2,
          -1.264807e-1,
          1.264807e-1,
          -1.465688e-1,
          1.465688e-1,
          -8.781464e-2,
          8.781464e-2,
          -8.552605e-2,
          8.552605e-2,
          -1.145072e-1,
          1.145072e-1,
          -1.378489e-1,
          1.378489e-1,
          -1.013312e-1,
          1.013312e-1,
          -1.020083e-1,
          1.020083e-1,
          -1.015816e-1,
          1.015816e-1,
          -8.407101e-2,
          8.407101e-2,
          -8.296485e-2,
          8.296485e-2,
          -8.033655e-2,
          8.033655e-2,
          -9.003615e-2,
          9.003615e-2,
          -7.504954e-2,
          7.504954e-2,
          -1.224941e-1,
          1.224941e-1,
          -9.347814e-2,
          9.347814e-2,
          -9.555575e-2,
          9.555575e-2,
          -9.810025e-2,
          9.810025e-2,
          -1.237068e-1,
          1.237068e-1,
          -1.283586e-1,
          1.283586e-1,
          -1.082763e-1,
          1.082763e-1,
          -1.018145e-1,
          1.018145e-1,
          -1.175161e-1,
          1.175161e-1,
          -1.252279e-1,
          1.252279e-1,
          -1.370559e-1,
          1.370559e-1,
          -9.941339e-2,
          9.941339e-2,
          -8.506938e-2,
          8.506938e-2,
          -1.260902e-1,
          1.260902e-1,
          -1.014152e-1,
          1.014152e-1,
          -9.728694e-2,
          9.728694e-2,
          -9.37491e-2,
          9.37491e-2,
          -9.587429e-2,
          9.587429e-2,
          -9.516036e-2,
          9.516036e-2,
          -7.375173e-2,
          7.375173e-2,
          -9.332487e-2,
          9.332487e-2,
          -9.020733e-2,
          9.020733e-2,
          -1.133381e-1,
          1.133381e-1,
          -1.54218e-1,
          1.54218e-1,
          -9.692168e-2,
          9.692168e-2,
          -7.960904e-2,
          7.960904e-2,
          -8.947089e-2,
          8.947089e-2,
          -7.830286e-2,
          7.830286e-2,
          -9.90005e-2,
          9.90005e-2,
          -1.041293e-1,
          1.041293e-1,
          -9.572501e-2,
          9.572501e-2,
          -8.230575e-2,
          8.230575e-2,
          -9.194901e-2,
          9.194901e-2,
          -1.076971e-1,
          1.076971e-1,
          -1.027782e-1,
          1.027782e-1,
          -1.028538e-1,
          1.028538e-1,
          -1.013992e-1,
          1.013992e-1,
          -9.087585e-2,
          9.087585e-2,
          -1.100706e-1,
          1.100706e-1,
          -1.094934e-1,
          1.094934e-1,
          -1.107879e-1,
          1.107879e-1,
          -1.026915e-1,
          1.026915e-1,
          -1.017572e-1,
          1.017572e-1,
          -7.984776e-2,
          7.984776e-2,
          -9.015413e-2,
          9.015413e-2,
          -1.29987e-1,
          1.29987e-1,
          -9.164982e-2,
          9.164982e-2,
          -1.062788e-1,
          1.062788e-1,
          -1.160203e-1,
          1.160203e-1,
          -8.858603e-2,
          8.858603e-2,
          -9.762964e-2,
          9.762964e-2,
          -1.070694e-1,
          1.070694e-1,
          -9.549046e-2,
          9.549046e-2,
          -1.533034e-1,
          1.533034e-1,
          -8.663316e-2,
          8.663316e-2,
          -9.303018e-2,
          9.303018e-2,
          -9.853582e-2,
          9.853582e-2,
          -9.733371e-2,
          9.733371e-2,
          -1.048555e-1,
          1.048555e-1,
          -9.056041e-2,
          9.056041e-2,
          -7.552283e-2,
          7.552283e-2,
          -8.780631e-2,
          8.780631e-2,
          -1.123953e-1,
          1.123953e-1,
          -1.452948e-1,
          1.452948e-1,
          -1.156423e-1,
          1.156423e-1,
          -8.701142e-2,
          8.701142e-2,
          -9.713334e-2,
          9.713334e-2,
          -9.970888e-2,
          9.970888e-2,
          -8.614129e-2,
          8.614129e-2,
          -7.459861e-2,
          7.459861e-2,
          -9.253517e-2,
          9.253517e-2,
          -9.570092e-2,
          9.570092e-2,
          -9.485535e-2,
          9.485535e-2,
          -1.148365e-1,
          1.148365e-1,
          -1.063193e-1,
          1.063193e-1,
          -9.986686e-2,
          9.986686e-2,
          -7.523412e-2,
          7.523412e-2,
          -1.005881e-1,
          1.005881e-1,
          -8.249716e-2,
          8.249716e-2,
          -1.055866e-1,
          1.055866e-1,
          -1.34305e-1,
          1.34305e-1,
          -1.371056e-1,
          1.371056e-1,
          -9.604689e-2,
          9.604689e-2,
          -1.224268e-1,
          1.224268e-1,
          -9.211478e-2,
          9.211478e-2,
          -1.108371e-1,
          1.108371e-1,
          -1.100547e-1,
          1.100547e-1,
          -8.93897e-2,
          8.93897e-2,
          -8.655951e-2,
          8.655951e-2,
          -7.085816e-2,
          7.085816e-2,
          -8.101028e-2,
          8.101028e-2,
          -8.338046e-2,
          8.338046e-2,
          -8.309588e-2,
          8.309588e-2,
          -9.090584e-2,
          9.090584e-2,
          -8.124564e-2,
          8.124564e-2,
          -9.367843e-2,
          9.367843e-2,
          -1.011747e-1,
          1.011747e-1,
          -9.885045e-2,
          9.885045e-2,
          -8.944266e-2,
          8.944266e-2,
          -8.453859e-2,
          8.453859e-2,
          -8.308847e-2,
          8.308847e-2,
          -1.36728e-1,
          1.36728e-1,
          -1.295144e-1,
          1.295144e-1,
          -1.063965e-1,
          1.063965e-1,
          -7.752328e-2,
          7.752328e-2,
          -9.681524e-2,
          9.681524e-2,
          -7.862345e-2,
          7.862345e-2,
          -8.767746e-2,
          8.767746e-2,
          -9.198041e-2,
          9.198041e-2,
          -9.686489e-2,
          9.686489e-2
        ]
      },
      {
        count: 564,
        threshold: -4.517456,
        feature: [
          {
            size: 5,
            px: [15, 9, 8, 12, 11],
            py: [3, 6, 3, 0, 8],
            pz: [0, 1, 0, 0, 0],
            nx: [6, 14, 9, 22, 23],
            ny: [8, 7, 8, 17, 3],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [12, 13, 11, 14, 12],
            py: [9, 4, 4, 4, 5],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 6, 10, 4, 15],
            ny: [3, 8, 7, 10, 9],
            nz: [1, 1, 0, 1, 0]
          },
          {
            size: 5,
            px: [7, 5, 6, 8, 8],
            py: [2, 13, 2, 1, 1],
            pz: [0, 0, 0, 0, -1],
            nx: [3, 0, 4, 1, 0],
            ny: [4, 3, 10, 3, 13],
            nz: [1, 1, 1, 0, 0]
          },
          {
            size: 5,
            px: [11, 2, 2, 11, 16],
            py: [9, 4, 2, 7, 11],
            pz: [0, 2, 2, 0, 0],
            nx: [8, 4, 1, 14, 0],
            ny: [4, 4, 16, 5, 13],
            nz: [1, 1, -1, -1, -1]
          },
          {
            size: 2,
            px: [14, 14],
            py: [18, 18],
            pz: [0, -1],
            nx: [8, 13],
            ny: [10, 16],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [15, 17, 16, 8, 18],
            py: [1, 2, 1, 0, 2],
            pz: [0, 0, 0, 1, 0],
            nx: [21, 22, 22, 22, 22],
            ny: [1, 5, 3, 4, 2],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [15, 4],
            py: [23, 3],
            pz: [0, 2],
            nx: [7, 3],
            ny: [10, 6],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [3, 6, 4, 3, 11],
            py: [10, 11, 8, 3, 8],
            pz: [1, 0, 1, 1, 0],
            nx: [3, 5, 6, 3, 0],
            ny: [4, 9, 9, 9, 0],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 3,
            px: [11, 11, 2],
            py: [11, 13, 16],
            pz: [0, 0, -1],
            nx: [10, 10, 9],
            ny: [10, 11, 14],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [8, 4],
            py: [12, 6],
            pz: [0, 1],
            nx: [4, 5],
            ny: [11, 11],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [10, 11, 13, 3, 12],
            py: [3, 4, 3, 0, 1],
            pz: [0, 0, 0, 2, 0],
            nx: [14, 18, 20, 19, 15],
            ny: [13, 1, 15, 2, 18],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 5,
            px: [20, 14, 10, 12, 12],
            py: [12, 12, 4, 10, 11],
            pz: [0, 0, 1, 0, 0],
            nx: [9, 2, 9, 9, 9],
            ny: [4, 12, 5, 9, 14],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [3, 3, 3, 4, 2],
            py: [15, 16, 14, 21, 12],
            pz: [0, 0, 0, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [20, 10, 5, 21, 21],
            nz: [0, 1, 2, 0, -1]
          },
          {
            size: 2,
            px: [18, 8],
            py: [16, 7],
            pz: [0, 1],
            nx: [14, 0],
            ny: [8, 10],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [12, 4, 16, 1],
            py: [14, 3, 8, 3],
            pz: [0, -1, -1, -1],
            nx: [14, 10, 20, 13],
            ny: [13, 5, 16, 9],
            nz: [0, 1, 0, 0]
          },
          {
            size: 5,
            px: [3, 8, 2, 3, 3],
            py: [7, 2, 1, 2, 4],
            pz: [1, -1, -1, -1, -1],
            nx: [1, 9, 2, 1, 1],
            ny: [3, 14, 9, 7, 2],
            nz: [1, 0, 1, 1, 1]
          },
          {
            size: 5,
            px: [4, 1, 3, 2, 3],
            py: [2, 1, 2, 4, 3],
            pz: [0, 1, 0, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [3, 1, 2, 0, 0],
            nz: [0, 1, 0, 2, -1]
          },
          {
            size: 4,
            px: [4, 8, 7, 9],
            py: [6, 11, 11, 10],
            pz: [1, 0, 0, 0],
            nx: [3, 10, 2, 20],
            ny: [4, 4, 4, 8],
            nz: [1, -1, -1, -1]
          },
          {
            size: 2,
            px: [1, 8],
            py: [3, 11],
            pz: [2, -1],
            nx: [8, 2],
            ny: [15, 5],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [17, 0],
            py: [13, 10],
            pz: [0, -1],
            nx: [14, 14],
            ny: [11, 10],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [22, 22, 22, 5, 22],
            py: [16, 18, 17, 2, 15],
            pz: [0, 0, 0, 2, 0],
            nx: [8, 4, 15, 6, 6],
            ny: [4, 2, 7, 11, 11],
            nz: [1, 2, 0, 1, -1]
          },
          {
            size: 5,
            px: [16, 9, 8, 17, 15],
            py: [12, 6, 6, 22, 12],
            pz: [0, 1, 1, 0, 0],
            nx: [11, 23, 23, 23, 22],
            ny: [11, 23, 22, 21, 23],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 5,
            px: [5, 2, 4, 4, 9],
            py: [22, 3, 15, 20, 18],
            pz: [0, 2, 0, 0, 0],
            nx: [9, 4, 23, 7, 22],
            ny: [8, 4, 22, 19, 23],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 5,
            px: [8, 6, 9, 7, 3],
            py: [3, 3, 3, 3, 1],
            pz: [0, 0, 0, 0, 1],
            nx: [5, 5, 4, 4, 4],
            ny: [0, 1, 1, 2, 0],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [2, 3],
            py: [3, 3],
            pz: [2, 2],
            nx: [3, 6],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [1, 1, 0, 1, 0],
            py: [17, 15, 6, 16, 10],
            pz: [0, 0, 1, 0, 0],
            nx: [4, 4, 7, 4, 8],
            ny: [2, 5, 9, 4, 4],
            nz: [2, 2, 1, 2, -1]
          },
          {
            size: 5,
            px: [12, 12, 12, 13, 13],
            py: [10, 9, 11, 13, 13],
            pz: [0, 0, 0, 0, -1],
            nx: [4, 3, 3, 5, 3],
            ny: [21, 18, 17, 23, 16],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 4,
            px: [5, 6, 5, 9],
            py: [13, 7, 9, 23],
            pz: [0, 0, 1, 0],
            nx: [6, 15, 7, 5],
            ny: [9, 20, 7, 23],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [4, 2],
            pz: [1, 2],
            nx: [8, 23],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 7],
            py: [18, 0],
            pz: [0, 0],
            nx: [5, 7],
            ny: [8, 10],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [4, 6],
            py: [11, 16],
            pz: [1, 0],
            nx: [10, 9],
            ny: [16, 7],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [11, 11, 11, 11],
            py: [11, 10, 12, 13],
            pz: [0, 0, 0, 0],
            nx: [13, 13, 13, 9],
            ny: [11, 9, 10, 4],
            nz: [0, 0, 0, 1]
          },
          {
            size: 4,
            px: [12, 6, 7, 6],
            py: [7, 11, 8, 4],
            pz: [0, 1, 1, 1],
            nx: [10, 0, 19, 7],
            ny: [21, 3, 12, 11],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 4],
            py: [3, 4],
            pz: [2, 2],
            nx: [9, 1],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [19, 19],
            py: [21, 20],
            pz: [0, 0],
            nx: [7, 7],
            ny: [3, 13],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [12, 9, 13, 11, 5],
            py: [0, 2, 2, 0, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [6, 4, 5, 5, 5],
            ny: [1, 3, 5, 2, 6],
            nz: [0, 0, 1, 0, 1]
          },
          {
            size: 5,
            px: [4, 3, 2, 5, 7],
            py: [11, 3, 3, 7, 17],
            pz: [1, 2, 2, 0, 0],
            nx: [23, 5, 11, 5, 5],
            ny: [0, 4, 10, 2, 6],
            nz: [0, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [20, 17],
            py: [12, 3],
            pz: [0, -1],
            nx: [20, 19],
            ny: [21, 23],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 1],
            py: [12, 8],
            pz: [0, 0],
            nx: [2, 8],
            ny: [2, 16],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [16, 5],
            py: [4, 5],
            pz: [0, -1],
            nx: [7, 8],
            ny: [9, 1],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [0, 1],
            pz: [1, 1],
            nx: [1, 8],
            ny: [5, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [1, 1],
            py: [12, 10],
            pz: [0, 1],
            nx: [2, 20],
            ny: [23, 9],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [11, 0, 0, 2],
            py: [14, 3, 9, 22],
            pz: [0, -1, -1, -1],
            nx: [13, 14, 7, 3],
            ny: [6, 7, 11, 1],
            nz: [0, 0, 0, 2]
          },
          {
            size: 2,
            px: [14, 0],
            py: [2, 3],
            pz: [0, -1],
            nx: [4, 4],
            ny: [4, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [23, 11],
            py: [18, 11],
            pz: [0, 1],
            nx: [3, 2],
            ny: [1, 21],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [17, 14],
            pz: [0, -1],
            nx: [4, 5],
            ny: [10, 8],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [9, 18],
            py: [7, 14],
            pz: [1, 0],
            nx: [18, 9],
            ny: [17, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 8],
            py: [4, 22],
            pz: [2, 0],
            nx: [4, 3],
            ny: [10, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 22],
            py: [4, 9],
            pz: [2, -1],
            nx: [11, 23],
            ny: [8, 14],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [23, 5, 5],
            py: [8, 2, 1],
            pz: [0, 2, 2],
            nx: [10, 10, 2],
            ny: [4, 4, 2],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [14, 23],
            pz: [0, -1],
            nx: [3, 11],
            ny: [4, 13],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [3, 2],
            py: [7, 0],
            pz: [1, -1],
            nx: [4, 3],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [12, 1],
            py: [19, 13],
            pz: [0, -1],
            nx: [9, 12],
            ny: [10, 18],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [10, 10],
            py: [11, 10],
            pz: [1, 1],
            nx: [4, 1],
            ny: [5, 11],
            nz: [2, -1]
          },
          {
            size: 5,
            px: [9, 12, 4, 8, 8],
            py: [3, 5, 2, 9, 8],
            pz: [1, 0, 2, 1, 1],
            nx: [23, 23, 23, 23, 23],
            ny: [3, 4, 6, 5, 5],
            nz: [0, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 9],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [13, 13, 13, 7, 7],
            py: [11, 10, 9, 6, 6],
            pz: [0, 0, 0, 1, -1],
            nx: [5, 5, 15, 5, 2],
            ny: [5, 15, 9, 9, 1],
            nz: [0, 0, 0, 1, 2]
          },
          {
            size: 2,
            px: [19, 7],
            py: [21, 7],
            pz: [0, 1],
            nx: [14, 10],
            ny: [15, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [3, 4],
            pz: [2, 2],
            nx: [21, 0],
            ny: [23, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 0],
            py: [0, 0],
            pz: [1, -1],
            nx: [3, 2],
            ny: [1, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [9, 0],
            py: [4, 0],
            pz: [0, -1],
            nx: [5, 12],
            ny: [0, 1],
            nz: [1, 0]
          },
          {
            size: 5,
            px: [14, 16, 12, 15, 13],
            py: [0, 1, 0, 0, 0],
            pz: [0, 0, 0, 0, 0],
            nx: [4, 8, 8, 4, 9],
            ny: [2, 3, 4, 1, 3],
            nz: [2, 1, 1, 2, -1]
          },
          {
            size: 3,
            px: [4, 17, 2],
            py: [11, 14, 1],
            pz: [1, -1, -1],
            nx: [9, 8, 17],
            ny: [1, 4, 0],
            nz: [1, 1, 0]
          },
          {
            size: 2,
            px: [18, 9],
            py: [17, 7],
            pz: [0, 1],
            nx: [8, 4],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [3, 0],
            pz: [1, 2],
            nx: [10, 11],
            ny: [6, 5],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [21, 21, 21, 21, 20],
            py: [17, 16, 19, 18, 21],
            pz: [0, 0, 0, 0, 0],
            nx: [0, 0, 0, 0, 0],
            ny: [4, 9, 11, 6, 6],
            nz: [1, 0, 0, 1, -1]
          },
          {
            size: 2,
            px: [12, 0],
            py: [7, 1],
            pz: [0, -1],
            nx: [8, 11],
            ny: [4, 17],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [13, 0, 0, 0],
            py: [15, 0, 0, 0],
            pz: [0, -1, -1, -1],
            nx: [3, 7, 4, 6],
            ny: [2, 7, 5, 9],
            nz: [2, 1, 2, 1]
          },
          {
            size: 2,
            px: [2, 9],
            py: [3, 12],
            pz: [2, 0],
            nx: [2, 0],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 3],
            py: [6, 1],
            pz: [1, -1],
            nx: [20, 21],
            ny: [19, 14],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [5, 22, 22, 11, 22],
            py: [1, 4, 3, 3, 2],
            pz: [2, 0, 0, 1, -1],
            nx: [7, 13, 14, 8, 15],
            ny: [3, 6, 6, 3, 7],
            nz: [1, 0, 0, 1, 0]
          },
          {
            size: 2,
            px: [12, 19],
            py: [5, 15],
            pz: [0, -1],
            nx: [16, 4],
            ny: [8, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [1, 0],
            py: [11, 9],
            pz: [1, 1],
            nx: [5, 0],
            ny: [3, 3],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [8, 3, 4, 2],
            py: [6, 7, 5, 3],
            pz: [1, -1, -1, -1],
            nx: [13, 14, 11, 11],
            ny: [11, 13, 3, 5],
            nz: [0, 0, 1, 1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [5, 6],
            pz: [0, 0],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 9],
            py: [6, 17],
            pz: [1, 0],
            nx: [9, 4],
            ny: [15, 11],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [6, 3, 6],
            py: [6, 3, 5],
            pz: [1, 2, 1],
            nx: [11, 10, 4],
            ny: [8, 11, 5],
            nz: [0, 0, -1]
          },
          {
            size: 2,
            px: [8, 16],
            py: [0, 1],
            pz: [1, -1],
            nx: [19, 17],
            ny: [1, 0],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [21, 20],
            py: [4, 1],
            pz: [0, 0],
            nx: [11, 5],
            ny: [0, 0],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [8, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [8, 9],
            ny: [4, 10],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 1],
            py: [0, 0],
            pz: [1, -1],
            nx: [13, 12],
            ny: [6, 5],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 4],
            py: [3, 11],
            pz: [1, -1],
            nx: [3, 17],
            ny: [1, 3],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [12, 13],
            py: [4, 4],
            pz: [0, 0],
            nx: [3, 3],
            ny: [1, 1],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [3, 18],
            py: [2, 7],
            pz: [2, 0],
            nx: [8, 1],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [16, 6],
            py: [8, 2],
            pz: [0, 1],
            nx: [8, 9],
            ny: [4, 19],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [12, 3, 14],
            py: [13, 3, 15],
            pz: [0, -1, -1],
            nx: [0, 1, 0],
            ny: [16, 18, 15],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [3, 1],
            py: [3, 4],
            pz: [2, -1],
            nx: [7, 14],
            ny: [10, 14],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [9, 16],
            py: [6, 10],
            pz: [1, 0],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 11],
            py: [4, 4],
            pz: [0, 0],
            nx: [7, 23],
            ny: [3, 11],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [2, 4, 3, 4, 4],
            py: [1, 2, 0, 1, 1],
            pz: [1, 0, 1, 0, -1],
            nx: [11, 9, 4, 9, 5],
            ny: [6, 5, 3, 6, 3],
            nz: [0, 0, 1, 0, 1]
          },
          {
            size: 2,
            px: [6, 0],
            py: [14, 1],
            pz: [0, -1],
            nx: [2, 5],
            ny: [2, 9],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [6, 7],
            py: [7, 12],
            pz: [0, 0],
            nx: [3, 22],
            ny: [3, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [1, 1],
            pz: [0, 1],
            nx: [2, 6],
            ny: [2, 21],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [13, 1],
            py: [11, 6],
            pz: [0, -1],
            nx: [12, 6],
            ny: [5, 2],
            nz: [0, 1]
          },
          {
            size: 5,
            px: [10, 5, 11, 10, 10],
            py: [4, 3, 4, 6, 5],
            pz: [0, 1, 0, 0, 0],
            nx: [4, 7, 13, 8, 4],
            ny: [2, 8, 9, 4, 4],
            nz: [2, 1, 0, 1, -1]
          },
          {
            size: 4,
            px: [7, 8, 7, 8],
            py: [11, 3, 4, 7],
            pz: [1, 1, 1, 1],
            nx: [0, 7, 3, 8],
            ny: [0, 12, 2, 4],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [4, 7],
            pz: [2, 1],
            nx: [10, 1],
            ny: [7, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [19, 5],
            pz: [0, -1],
            nx: [11, 5],
            ny: [17, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [11, 12],
            py: [4, 4],
            pz: [0, 0],
            nx: [7, 5],
            ny: [8, 3],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [4, 8, 4],
            py: [2, 9, 4],
            pz: [2, 1, 2],
            nx: [3, 19, 3],
            ny: [1, 16, 5],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [3, 7],
            py: [0, 1],
            pz: [1, 0],
            nx: [2, 3],
            ny: [15, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 4],
            py: [2, 0],
            pz: [2, -1],
            nx: [9, 16],
            ny: [5, 11],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [14, 15],
            py: [23, 16],
            pz: [0, 0],
            nx: [13, 3],
            ny: [15, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [0, 1],
            pz: [1, -1],
            nx: [3, 7],
            ny: [0, 0],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [7, 6],
            py: [12, 12],
            pz: [0, 0],
            nx: [4, 8],
            ny: [5, 4],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [4, 1, 2, 4, 5],
            py: [1, 0, 0, 0, 6],
            pz: [0, 2, 1, 0, 1],
            nx: [4, 8, 7, 8, 6],
            ny: [4, 10, 11, 4, 4],
            nz: [1, 0, 0, 1, 1]
          },
          {
            size: 2,
            px: [12, 12],
            py: [15, 8],
            pz: [0, -1],
            nx: [7, 15],
            ny: [16, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 8],
            py: [3, 6],
            pz: [2, 1],
            nx: [4, 6],
            ny: [2, 8],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [14, 4],
            py: [19, 23],
            pz: [0, -1],
            nx: [7, 14],
            ny: [11, 18],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [4, 2],
            py: [7, 4],
            pz: [1, 2],
            nx: [2, 22],
            ny: [5, 19],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [8, 15],
            py: [7, 17],
            pz: [1, 0],
            nx: [14, 4],
            ny: [15, 5],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [10, 11],
            py: [9, 8],
            pz: [1, -1],
            nx: [23, 5],
            ny: [19, 4],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [11, 1],
            py: [7, 9],
            pz: [0, -1],
            nx: [4, 4],
            ny: [4, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [14, 7],
            py: [6, 9],
            pz: [0, 0],
            nx: [4, 11],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 4],
            py: [0, 5],
            pz: [0, -1],
            nx: [2, 2],
            ny: [0, 4],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [10, 22],
            py: [5, 20],
            pz: [0, -1],
            nx: [3, 4],
            ny: [1, 2],
            nz: [2, 2]
          },
          {
            size: 3,
            px: [23, 11, 11],
            py: [17, 9, 8],
            pz: [0, 1, 1],
            nx: [13, 8, 8],
            ny: [5, 3, 3],
            nz: [0, 1, -1]
          },
          {
            size: 2,
            px: [18, 9],
            py: [0, 21],
            pz: [0, -1],
            nx: [10, 10],
            ny: [2, 1],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [11, 10, 11, 11, 11],
            py: [11, 13, 10, 12, 12],
            pz: [0, 0, 0, 0, -1],
            nx: [11, 13, 12, 3, 8],
            ny: [5, 5, 5, 1, 10],
            nz: [0, 0, 0, 2, 0]
          },
          {
            size: 2,
            px: [7, 8],
            py: [11, 11],
            pz: [0, 0],
            nx: [9, 16],
            ny: [9, 19],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 18],
            py: [23, 7],
            pz: [0, -1],
            nx: [21, 21],
            ny: [7, 13],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 8],
            py: [7, 8],
            pz: [1, 1],
            nx: [5, 21],
            ny: [9, 13],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [17, 8],
            py: [22, 8],
            pz: [0, -1],
            nx: [4, 8],
            ny: [5, 10],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [2, 5, 8, 8, 4],
            py: [3, 9, 13, 23, 7],
            pz: [2, 1, 0, 0, 1],
            nx: [9, 17, 18, 19, 20],
            ny: [0, 0, 0, 2, 3],
            nz: [1, 0, 0, 0, 0]
          },
          {
            size: 3,
            px: [16, 15, 2],
            py: [3, 3, 13],
            pz: [0, 0, -1],
            nx: [4, 8, 4],
            ny: [3, 6, 2],
            nz: [2, 1, 2]
          },
          {
            size: 2,
            px: [4, 7],
            py: [3, 7],
            pz: [2, 1],
            nx: [15, 1],
            ny: [15, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [2, 3],
            pz: [2, 1],
            nx: [3, 18],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [2, 4],
            pz: [2, 1],
            nx: [3, 0],
            ny: [5, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [10, 0],
            pz: [0, -1],
            nx: [9, 4],
            ny: [2, 0],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [2, 0],
            py: [8, 3],
            pz: [1, -1],
            nx: [4, 8],
            ny: [4, 14],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [13, 18],
            py: [14, 14],
            pz: [0, -1],
            nx: [1, 1],
            ny: [15, 13],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [3, 2, 2],
            py: [17, 10, 15],
            pz: [0, 1, 0],
            nx: [13, 2, 7],
            ny: [19, 11, 0],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [4, 17],
            py: [0, 2],
            pz: [2, 0],
            nx: [8, 5],
            ny: [11, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [15, 21],
            py: [5, 4],
            pz: [0, -1],
            nx: [15, 10],
            ny: [3, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [7, 3],
            py: [13, 8],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [7, 22],
            py: [3, 4],
            pz: [1, -1],
            nx: [4, 2],
            ny: [2, 3],
            nz: [1, 1]
          },
          {
            size: 4,
            px: [6, 2, 6, 5],
            py: [21, 10, 22, 20],
            pz: [0, 1, 0, 0],
            nx: [2, 3, 4, 4],
            ny: [11, 21, 23, 23],
            nz: [1, 0, 0, -1]
          },
          {
            size: 2,
            px: [7, 2],
            py: [6, 8],
            pz: [1, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 4,
            px: [11, 11, 5, 11],
            py: [6, 5, 2, 4],
            pz: [1, 1, 2, 1],
            nx: [13, 7, 8, 3],
            ny: [7, 3, 5, 2],
            nz: [0, 1, -1, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [7, 8],
            pz: [1, 0],
            nx: [3, 11],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [16, 1, 5],
            py: [3, 3, 11],
            pz: [0, -1, -1],
            nx: [16, 4, 8],
            ny: [2, 0, 1],
            nz: [0, 2, 1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [8, 1],
            pz: [0, -1],
            nx: [19, 18],
            ny: [20, 23],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [17, 4],
            py: [10, 4],
            pz: [0, -1],
            nx: [4, 14],
            ny: [2, 9],
            nz: [2, 0]
          },
          {
            size: 5,
            px: [11, 12, 9, 10, 11],
            py: [2, 3, 2, 2, 3],
            pz: [0, 0, 0, 0, 0],
            nx: [6, 4, 2, 2, 2],
            ny: [18, 9, 3, 2, 2],
            nz: [0, 1, 2, 2, -1]
          },
          {
            size: 2,
            px: [0, 1],
            py: [6, 16],
            pz: [1, 0],
            nx: [8, 16],
            ny: [5, 16],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [2, 3],
            pz: [2, 2],
            nx: [8, 17],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [2, 5, 2],
            py: [5, 6, 4],
            pz: [1, -1, -1],
            nx: [0, 0, 0],
            ny: [3, 5, 6],
            nz: [2, 1, 1]
          },
          {
            size: 5,
            px: [0, 0, 0, 0, 0],
            py: [6, 15, 16, 13, 14],
            pz: [1, 0, 0, 0, 0],
            nx: [4, 5, 8, 6, 8],
            ny: [4, 16, 8, 15, 4],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [3, 5],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [21, 19, 21, 21, 21],
            py: [17, 23, 18, 19, 20],
            pz: [0, 0, 0, 0, 0],
            nx: [5, 2, 3, 6, 6],
            ny: [12, 5, 5, 12, 12],
            nz: [0, 1, 1, 0, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [11, 1],
            pz: [1, -1],
            nx: [5, 11],
            ny: [3, 5],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [5, 3],
            pz: [0, 1],
            nx: [6, 15],
            ny: [11, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 2],
            py: [4, 2],
            pz: [1, -1],
            nx: [4, 3],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [10, 6],
            py: [20, 6],
            pz: [0, -1],
            nx: [5, 10],
            ny: [11, 17],
            nz: [1, 0]
          },
          {
            size: 4,
            px: [8, 4, 7, 11],
            py: [7, 4, 5, 8],
            pz: [1, 2, 1, 0],
            nx: [13, 10, 5, 21],
            ny: [9, 3, 5, 4],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [7, 13],
            py: [10, 7],
            pz: [0, 0],
            nx: [10, 8],
            ny: [9, 18],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 3],
            py: [1, 0],
            pz: [2, 2],
            nx: [8, 5],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [5, 2, 5, 8, 4],
            py: [8, 4, 14, 23, 7],
            pz: [1, 2, 0, 0, 1],
            nx: [18, 4, 16, 17, 17],
            ny: [1, 0, 0, 1, 1],
            nz: [0, 2, 0, 0, -1]
          },
          {
            size: 2,
            px: [6, 2],
            py: [2, 4],
            pz: [1, -1],
            nx: [8, 8],
            ny: [4, 3],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 1],
            py: [8, 15],
            pz: [0, -1],
            nx: [8, 3],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 1],
            py: [7, 2],
            pz: [1, -1],
            nx: [6, 6],
            ny: [9, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [4, 1],
            py: [6, 2],
            pz: [1, -1],
            nx: [1, 10],
            ny: [16, 12],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 4],
            py: [7, 2],
            pz: [1, -1],
            nx: [8, 9],
            ny: [8, 10],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [4, 8, 7, 6, 6],
            py: [0, 0, 0, 1, 1],
            pz: [1, 0, 0, 0, -1],
            nx: [11, 5, 8, 4, 10],
            ny: [5, 3, 4, 4, 5],
            nz: [0, 1, 1, 1, 0]
          },
          {
            size: 2,
            px: [5, 6],
            py: [8, 5],
            pz: [0, 0],
            nx: [6, 6],
            ny: [8, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [18, 5],
            py: [19, 5],
            pz: [0, -1],
            nx: [4, 21],
            ny: [5, 19],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [9, 5],
            py: [13, 6],
            pz: [0, 1],
            nx: [2, 2],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [17, 6],
            pz: [0, 1],
            nx: [10, 2],
            ny: [15, 4],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [13, 13, 19],
            py: [11, 12, 8],
            pz: [0, 0, -1],
            nx: [12, 3, 8],
            ny: [4, 1, 4],
            nz: [0, 2, 1]
          },
          {
            size: 3,
            px: [11, 7, 4],
            py: [5, 2, 1],
            pz: [0, -1, -1],
            nx: [9, 2, 4],
            ny: [11, 3, 6],
            nz: [0, 2, 1]
          },
          {
            size: 2,
            px: [10, 7],
            py: [15, 2],
            pz: [0, -1],
            nx: [4, 4],
            ny: [0, 1],
            nz: [2, 2]
          },
          {
            size: 5,
            px: [8, 9, 16, 18, 18],
            py: [0, 1, 1, 1, 1],
            pz: [1, 1, 0, 0, -1],
            nx: [5, 5, 6, 4, 4],
            ny: [21, 20, 23, 17, 18],
            nz: [0, 0, 0, 0, 0]
          },
          {
            size: 2,
            px: [6, 7],
            py: [1, 1],
            pz: [1, 1],
            nx: [20, 19],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 2],
            py: [10, 11],
            pz: [1, 1],
            nx: [3, 3],
            ny: [10, 10],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 5],
            py: [23, 1],
            pz: [0, -1],
            nx: [4, 3],
            ny: [10, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [1, 10],
            py: [4, 7],
            pz: [2, -1],
            nx: [4, 3],
            ny: [23, 21],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [10, 21],
            py: [11, 18],
            pz: [1, 0],
            nx: [10, 4],
            ny: [18, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 23],
            py: [11, 15],
            pz: [0, -1],
            nx: [11, 11],
            ny: [7, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 1],
            py: [7, 7],
            pz: [1, -1],
            nx: [15, 4],
            ny: [14, 4],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [1, 2],
            py: [9, 20],
            pz: [1, 0],
            nx: [21, 3],
            ny: [12, 20],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [7, 4],
            py: [0, 0],
            pz: [1, 2],
            nx: [4, 2],
            ny: [0, 19],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [3, 6],
            pz: [2, 1],
            nx: [3, 0],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 1],
            py: [5, 0],
            pz: [1, -1],
            nx: [12, 10],
            ny: [11, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [11, 12],
            py: [11, 14],
            pz: [1, -1],
            nx: [18, 16],
            ny: [21, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 18],
            py: [1, 5],
            pz: [2, -1],
            nx: [4, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [9, 10],
            py: [18, 7],
            pz: [0, -1],
            nx: [3, 6],
            ny: [0, 0],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [19, 2],
            py: [1, 4],
            pz: [0, -1],
            nx: [22, 22],
            ny: [13, 15],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [13, 15, 20],
            py: [14, 21, 10],
            pz: [0, -1, -1],
            nx: [15, 7, 7],
            ny: [13, 6, 8],
            nz: [0, 1, 1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [6, 7],
            pz: [1, 1],
            nx: [8, 7],
            ny: [4, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 3],
            pz: [1, 2],
            nx: [5, 10],
            ny: [2, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [14, 11],
            py: [7, 16],
            pz: [0, -1],
            nx: [1, 0],
            ny: [17, 4],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [14, 18],
            py: [17, 18],
            pz: [0, -1],
            nx: [8, 14],
            ny: [10, 16],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [6, 11],
            py: [13, 11],
            pz: [0, -1],
            nx: [8, 9],
            ny: [12, 9],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [8, 9],
            py: [2, 2],
            pz: [0, 0],
            nx: [3, 3],
            ny: [2, 2],
            nz: [2, -1]
          },
          {
            size: 3,
            px: [21, 21, 21],
            py: [14, 16, 15],
            pz: [0, 0, 0],
            nx: [14, 12, 0],
            ny: [5, 12, 6],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [4, 21],
            py: [6, 15],
            pz: [1, -1],
            nx: [5, 1],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [2, 1],
            pz: [1, 2],
            nx: [8, 0],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 2],
            py: [9, 1],
            pz: [0, -1],
            nx: [3, 5],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [16, 1],
            py: [5, 4],
            pz: [0, -1],
            nx: [17, 8],
            ny: [3, 2],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [9, 2],
            py: [7, 1],
            pz: [1, -1],
            nx: [20, 20],
            ny: [17, 16],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 7],
            py: [3, 6],
            pz: [2, -1],
            nx: [9, 9],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [11, 17],
            py: [4, 1],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [15, 2],
            py: [11, 0],
            pz: [0, -1],
            nx: [5, 14],
            ny: [1, 12],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [22, 19],
            py: [3, 0],
            pz: [0, -1],
            nx: [9, 4],
            ny: [6, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [1, 22],
            py: [3, 21],
            pz: [0, -1],
            nx: [0, 0],
            ny: [1, 0],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [11, 11],
            py: [11, 12],
            pz: [0, 0],
            nx: [1, 2],
            ny: [1, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [18, 3],
            py: [8, 1],
            pz: [0, 2],
            nx: [13, 1],
            ny: [8, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 6],
            py: [21, 3],
            pz: [0, -1],
            nx: [11, 11],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [15, 14],
            py: [4, 4],
            pz: [0, 0],
            nx: [17, 1],
            ny: [12, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 3],
            py: [12, 1],
            pz: [0, -1],
            nx: [1, 2],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [3, 2],
            py: [7, 3],
            pz: [0, 1],
            nx: [16, 2],
            ny: [3, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [7, 20],
            pz: [1, -1],
            nx: [9, 8],
            ny: [4, 6],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [19, 2],
            py: [10, 2],
            pz: [0, -1],
            nx: [9, 4],
            ny: [3, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [14, 9],
            py: [0, 23],
            pz: [0, -1],
            nx: [4, 4],
            ny: [3, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [6, 9],
            py: [4, 10],
            pz: [1, 0],
            nx: [10, 9],
            ny: [9, 0],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [6, 9, 10, 8],
            py: [20, 23, 18, 23],
            pz: [0, 0, 0, 0],
            nx: [9, 22, 1, 2],
            ny: [21, 14, 2, 5],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [17, 18],
            py: [13, 6],
            pz: [0, -1],
            nx: [6, 7],
            ny: [9, 11],
            nz: [1, 1]
          },
          {
            size: 5,
            px: [18, 19, 20, 19, 20],
            py: [15, 19, 16, 20, 17],
            pz: [0, 0, 0, 0, 0],
            nx: [11, 22, 23, 23, 23],
            ny: [10, 22, 20, 19, 19],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [1, 0],
            pz: [1, 1],
            nx: [21, 11],
            ny: [0, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 0],
            py: [9, 3],
            pz: [0, -1],
            nx: [9, 4],
            ny: [2, 1],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [14, 23],
            py: [2, 18],
            pz: [0, -1],
            nx: [15, 18],
            ny: [1, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [9, 3],
            py: [0, 0],
            pz: [1, -1],
            nx: [3, 12],
            ny: [1, 5],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [8, 8],
            py: [7, 8],
            pz: [1, 1],
            nx: [8, 8],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [1, 0],
            py: [1, 3],
            pz: [2, -1],
            nx: [7, 19],
            ny: [9, 15],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [16, 6, 4],
            py: [21, 5, 4],
            pz: [0, -1, -1],
            nx: [4, 19, 8],
            ny: [5, 21, 11],
            nz: [2, 0, 1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [6, 6],
            pz: [1, -1],
            nx: [10, 10],
            ny: [10, 12],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [6, 11],
            py: [2, 5],
            pz: [1, 0],
            nx: [3, 4],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [8, 6, 2],
            py: [4, 10, 2],
            pz: [1, 1, 2],
            nx: [2, 18, 5],
            ny: [0, 11, 5],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [11, 7],
            py: [9, 7],
            pz: [0, -1],
            nx: [12, 3],
            ny: [9, 5],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [14, 13],
            py: [20, 20],
            pz: [0, 0],
            nx: [13, 3],
            ny: [21, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 7],
            py: [5, 3],
            pz: [0, -1],
            nx: [3, 4],
            ny: [1, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [6, 2],
            py: [21, 5],
            pz: [0, -1],
            nx: [2, 3],
            ny: [5, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [23, 5],
            py: [6, 0],
            pz: [0, 2],
            nx: [21, 4],
            ny: [6, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [7, 6],
            pz: [1, 1],
            nx: [8, 2],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [22, 11],
            py: [20, 9],
            pz: [0, 1],
            nx: [8, 8],
            ny: [10, 10],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 16],
            py: [21, 12],
            pz: [0, -1],
            nx: [2, 7],
            ny: [5, 23],
            nz: [2, 0]
          },
          {
            size: 5,
            px: [0, 1, 1, 1, 1],
            py: [3, 1, 9, 4, 7],
            pz: [2, 2, 1, 1, 1],
            nx: [11, 22, 22, 23, 23],
            ny: [10, 21, 22, 19, 20],
            nz: [1, 0, 0, 0, -1]
          },
          {
            size: 2,
            px: [17, 5],
            py: [12, 4],
            pz: [0, -1],
            nx: [8, 8],
            ny: [4, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [16, 4],
            py: [7, 10],
            pz: [0, -1],
            nx: [9, 15],
            ny: [4, 6],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [3, 6],
            py: [3, 5],
            pz: [2, 1],
            nx: [11, 12],
            ny: [11, 23],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [14, 7],
            pz: [0, 1],
            nx: [4, 17],
            ny: [18, 16],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [10, 1, 1],
            py: [12, 5, 4],
            pz: [0, -1, -1],
            nx: [7, 11, 5],
            ny: [1, 2, 1],
            nz: [1, 0, 1]
          },
          {
            size: 2,
            px: [7, 6],
            py: [3, 9],
            pz: [0, -1],
            nx: [2, 2],
            ny: [2, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [13, 6],
            py: [22, 9],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 3],
            nz: [1, 2]
          },
          {
            size: 5,
            px: [12, 9, 10, 11, 11],
            py: [0, 0, 0, 0, 0],
            pz: [0, 0, 0, 0, -1],
            nx: [16, 5, 10, 4, 8],
            ny: [10, 3, 6, 4, 4],
            nz: [0, 1, 0, 1, 1]
          },
          {
            size: 2,
            px: [18, 19],
            py: [23, 20],
            pz: [0, 0],
            nx: [8, 5],
            ny: [11, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 3],
            py: [7, 2],
            pz: [1, 2],
            nx: [8, 4],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [8, 14, 8, 7, 4],
            py: [6, 12, 8, 6, 3],
            pz: [1, 0, 1, 1, 2],
            nx: [2, 6, 6, 7, 7],
            ny: [0, 1, 2, 0, 0],
            nz: [2, 0, 0, 0, -1]
          },
          {
            size: 3,
            px: [1, 2, 3],
            py: [15, 18, 21],
            pz: [0, 0, 0],
            nx: [19, 5, 18],
            ny: [23, 5, 8],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [6, 2],
            py: [6, 1],
            pz: [1, -1],
            nx: [0, 0],
            ny: [12, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [3, 5],
            py: [5, 11],
            pz: [2, 1],
            nx: [14, 5],
            ny: [19, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 4],
            py: [4, 4],
            pz: [1, -1],
            nx: [11, 5],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [18, 4],
            py: [6, 4],
            pz: [0, -1],
            nx: [4, 8],
            ny: [5, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 12],
            py: [2, 4],
            pz: [1, 0],
            nx: [8, 8],
            ny: [3, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [1, 0],
            py: [1, 1],
            pz: [1, 2],
            nx: [7, 2],
            ny: [4, 7],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 0],
            py: [20, 0],
            pz: [0, -1],
            nx: [4, 5],
            ny: [10, 11],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 14],
            py: [5, 2],
            pz: [1, -1],
            nx: [0, 0],
            ny: [0, 2],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [5, 15],
            py: [4, 7],
            pz: [1, -1],
            nx: [4, 7],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [7, 5],
            py: [2, 1],
            pz: [0, 1],
            nx: [3, 1],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 9],
            py: [4, 2],
            pz: [0, -1],
            nx: [11, 9],
            ny: [1, 3],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [6, 3],
            py: [2, 4],
            pz: [1, -1],
            nx: [4, 8],
            ny: [4, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [3, 7],
            py: [3, 7],
            pz: [2, 1],
            nx: [6, 8],
            ny: [14, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 0],
            py: [21, 3],
            pz: [0, 2],
            nx: [20, 8],
            ny: [10, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [5, 8],
            pz: [0, -1],
            nx: [4, 3],
            ny: [4, 2],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 13],
            pz: [1, 0],
            nx: [3, 2],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [16, 10],
            py: [9, 7],
            pz: [0, 1],
            nx: [7, 9],
            ny: [3, 10],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 10],
            py: [6, 7],
            pz: [0, -1],
            nx: [8, 17],
            ny: [4, 12],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [5, 10],
            py: [4, 10],
            pz: [2, 1],
            nx: [5, 4],
            ny: [9, 2],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [15, 3, 5, 0],
            py: [12, 4, 2, 3],
            pz: [0, -1, -1, -1],
            nx: [13, 7, 5, 7],
            ny: [12, 6, 0, 7],
            nz: [0, 1, 2, 1]
          },
          {
            size: 4,
            px: [2, 3, 16, 17],
            py: [3, 4, 6, 6],
            pz: [2, 1, 0, 0],
            nx: [16, 16, 8, 16],
            ny: [8, 3, 10, 13],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [16, 8],
            py: [1, 4],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [9, 14],
            py: [6, 2],
            pz: [1, -1],
            nx: [8, 8],
            ny: [6, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [10, 4],
            pz: [1, 2],
            nx: [10, 0],
            ny: [5, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [9, 10],
            py: [4, 4],
            pz: [0, 0],
            nx: [9, 7],
            ny: [3, 5],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [11, 10, 13, 6, 12],
            py: [2, 2, 2, 1, 2],
            pz: [0, 0, 0, 1, 0],
            nx: [4, 18, 18, 13, 13],
            ny: [2, 18, 19, 7, 7],
            nz: [2, 0, 0, 0, -1]
          },
          {
            size: 4,
            px: [13, 13, 13, 2],
            py: [13, 12, 11, 3],
            pz: [0, 0, 0, -1],
            nx: [4, 6, 8, 11],
            ny: [2, 2, 4, 4],
            nz: [2, 1, 1, 0]
          },
          {
            size: 2,
            px: [4, 7],
            py: [6, 13],
            pz: [1, 0],
            nx: [8, 10],
            ny: [4, 22],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 7],
            py: [4, 17],
            pz: [1, -1],
            nx: [0, 1],
            ny: [5, 21],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [12, 13],
            py: [22, 22],
            pz: [0, 0],
            nx: [2, 2],
            ny: [13, 13],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [4, 4, 3],
            py: [22, 23, 19],
            pz: [0, 0, 0],
            nx: [8, 12, 3],
            ny: [22, 15, 2],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [10, 12],
            py: [3, 13],
            pz: [0, -1],
            nx: [15, 2],
            ny: [10, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [1, 1],
            py: [3, 3],
            pz: [2, -1],
            nx: [8, 4],
            ny: [0, 0],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [6, 12],
            py: [6, 18],
            pz: [1, 0],
            nx: [12, 19],
            ny: [17, 16],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [2, 1],
            pz: [0, 1],
            nx: [5, 4],
            ny: [4, 17],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [3, 12, 11],
            py: [5, 23, 23],
            pz: [2, 0, 0],
            nx: [12, 4, 4],
            ny: [21, 17, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [12, 0],
            py: [21, 5],
            pz: [0, -1],
            nx: [0, 0],
            ny: [7, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [17, 17],
            py: [12, 11],
            pz: [0, 0],
            nx: [8, 11],
            ny: [4, 11],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 0],
            py: [22, 1],
            pz: [0, -1],
            nx: [4, 6],
            ny: [1, 0],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [9, 5],
            pz: [1, 1],
            nx: [23, 11],
            ny: [23, 20],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [4, 12, 11, 9, 8],
            py: [0, 1, 1, 0, 1],
            pz: [1, 0, 0, 0, 0],
            nx: [4, 17, 8, 7, 7],
            ny: [2, 13, 4, 4, 4],
            nz: [2, 0, 1, 1, -1]
          },
          {
            size: 2,
            px: [11, 13],
            py: [12, 12],
            pz: [0, -1],
            nx: [1, 1],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [23, 4],
            py: [23, 2],
            pz: [0, -1],
            nx: [5, 2],
            ny: [23, 6],
            nz: [0, 1]
          },
          {
            size: 3,
            px: [8, 16, 0],
            py: [5, 15, 6],
            pz: [1, -1, -1],
            nx: [23, 23, 11],
            ny: [18, 17, 8],
            nz: [0, 0, 1]
          },
          {
            size: 2,
            px: [1, 16],
            py: [4, 15],
            pz: [2, -1],
            nx: [2, 2],
            ny: [3, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [3, 8],
            py: [7, 9],
            pz: [1, -1],
            nx: [4, 2],
            ny: [10, 5],
            nz: [1, 2]
          },
          {
            size: 3,
            px: [22, 1, 9],
            py: [23, 2, 3],
            pz: [0, -1, -1],
            nx: [2, 2, 5],
            ny: [5, 4, 19],
            nz: [2, 2, 0]
          },
          {
            size: 2,
            px: [2, 20],
            py: [5, 15],
            pz: [1, -1],
            nx: [2, 1],
            ny: [1, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [4, 8],
            py: [1, 19],
            pz: [1, -1],
            nx: [2, 2],
            ny: [5, 4],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [9, 10],
            py: [21, 0],
            pz: [0, -1],
            nx: [6, 5],
            ny: [1, 1],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [4, 8],
            py: [3, 6],
            pz: [2, 1],
            nx: [9, 2],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [17, 3, 10],
            py: [8, 0, 2],
            pz: [0, 2, 0],
            nx: [13, 2, 6],
            ny: [15, 5, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [9, 6],
            py: [20, 21],
            pz: [0, -1],
            nx: [4, 2],
            ny: [10, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [3, 7],
            py: [0, 1],
            pz: [2, 1],
            nx: [7, 20],
            ny: [1, 19],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 5],
            py: [0, 1],
            pz: [1, 0],
            nx: [3, 2],
            ny: [4, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 7],
            py: [4, 19],
            pz: [2, 0],
            nx: [5, 2],
            ny: [10, 2],
            nz: [1, -1]
          },
          {
            size: 5,
            px: [3, 3, 4, 7, 7],
            py: [1, 0, 0, 0, 1],
            pz: [1, 1, 1, 0, 0],
            nx: [5, 4, 10, 8, 8],
            ny: [3, 3, 5, 4, 4],
            nz: [1, 1, 0, 1, -1]
          },
          {
            size: 2,
            px: [1, 5],
            py: [0, 3],
            pz: [1, -1],
            nx: [1, 0],
            ny: [0, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [5, 5],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [0, 9],
            py: [0, 4],
            pz: [2, -1],
            nx: [13, 10],
            ny: [0, 0],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [13, 4],
            py: [14, 5],
            pz: [0, -1],
            nx: [4, 2],
            ny: [0, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [17, 4],
            py: [13, 3],
            pz: [0, -1],
            nx: [4, 2],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [1, 0],
            py: [6, 2],
            pz: [1, -1],
            nx: [1, 6],
            ny: [2, 12],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [12, 4],
            py: [6, 0],
            pz: [0, -1],
            nx: [3, 3],
            ny: [8, 9],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [1, 5],
            py: [1, 5],
            pz: [1, -1],
            nx: [17, 17],
            ny: [13, 7],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [7, 3],
            py: [12, 6],
            pz: [0, 1],
            nx: [3, 4],
            ny: [4, 11],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 17],
            py: [2, 8],
            pz: [1, 0],
            nx: [3, 3],
            ny: [1, 2],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [13, 6, 6],
            py: [22, 11, 10],
            pz: [0, 1, 1],
            nx: [13, 12, 11],
            ny: [20, 20, 20],
            nz: [0, 0, 0]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [3, 12],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [1, 1],
            pz: [1, -1],
            nx: [13, 6],
            ny: [0, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [2, 8],
            py: [3, 9],
            pz: [2, 0],
            nx: [8, 16],
            ny: [5, 17],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 15],
            py: [1, 1],
            pz: [0, 0],
            nx: [7, 11],
            ny: [8, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 18],
            py: [21, 23],
            pz: [0, -1],
            nx: [1, 1],
            ny: [4, 3],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [1, 5],
            py: [0, 2],
            pz: [1, -1],
            nx: [15, 11],
            ny: [8, 7],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 4],
            py: [7, 8],
            pz: [1, -1],
            nx: [9, 10],
            ny: [13, 11],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [7, 4],
            py: [10, 4],
            pz: [1, 2],
            nx: [22, 4],
            ny: [0, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 3],
            py: [3, 1],
            pz: [0, 2],
            nx: [8, 0],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 21],
            py: [11, 22],
            pz: [0, -1],
            nx: [10, 11],
            ny: [11, 9],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 5],
            py: [0, 1],
            pz: [2, 2],
            nx: [2, 21],
            ny: [6, 14],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [10, 10, 1],
            py: [11, 0, 5],
            pz: [0, -1, -1],
            nx: [6, 12, 5],
            ny: [2, 5, 2],
            nz: [1, 0, 1]
          },
          {
            size: 2,
            px: [9, 10],
            py: [5, 6],
            pz: [0, 0],
            nx: [12, 19],
            ny: [23, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [9, 6],
            pz: [0, 1],
            nx: [21, 0],
            ny: [23, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 12],
            py: [19, 15],
            pz: [0, 0],
            nx: [13, 0],
            ny: [17, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [14, 0],
            py: [17, 3],
            pz: [0, -1],
            nx: [7, 16],
            ny: [8, 19],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [3, 6],
            py: [2, 4],
            pz: [2, 1],
            nx: [8, 1],
            ny: [4, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 10],
            py: [23, 20],
            pz: [0, -1],
            nx: [4, 7],
            ny: [5, 10],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [16, 9],
            py: [22, 5],
            pz: [0, -1],
            nx: [4, 2],
            ny: [10, 3],
            nz: [1, 2]
          },
          {
            size: 4,
            px: [3, 1, 1, 5],
            py: [4, 2, 1, 2],
            pz: [0, 2, 2, 1],
            nx: [13, 5, 8, 0],
            ny: [22, 2, 9, 2],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [0, 0],
            pz: [1, -1],
            nx: [19, 20],
            ny: [1, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [7, 22],
            py: [6, 8],
            pz: [1, 0],
            nx: [4, 4],
            ny: [2, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [4, 4],
            pz: [2, 1],
            nx: [10, 20],
            ny: [10, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 12],
            py: [6, 15],
            pz: [1, -1],
            nx: [0, 0],
            ny: [2, 5],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [2, 7],
            py: [4, 10],
            pz: [2, -1],
            nx: [3, 6],
            ny: [4, 8],
            nz: [2, 1]
          },
          {
            size: 3,
            px: [11, 11, 4],
            py: [0, 5, 7],
            pz: [1, -1, -1],
            nx: [6, 12, 12],
            ny: [1, 1, 2],
            nz: [1, 0, 0]
          },
          {
            size: 2,
            px: [11, 17],
            py: [4, 18],
            pz: [0, -1],
            nx: [8, 2],
            ny: [10, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [17, 17],
            py: [10, 18],
            pz: [0, -1],
            nx: [8, 8],
            ny: [2, 3],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [9, 9],
            py: [7, 7],
            pz: [1, -1],
            nx: [7, 4],
            ny: [6, 3],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [18, 21],
            py: [0, 0],
            pz: [0, -1],
            nx: [11, 6],
            ny: [5, 3],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [5, 2],
            py: [8, 4],
            pz: [0, 2],
            nx: [5, 8],
            ny: [9, 16],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 2],
            py: [5, 4],
            pz: [0, -1],
            nx: [4, 15],
            ny: [4, 8],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [1, 1],
            py: [4, 6],
            pz: [1, 1],
            nx: [11, 3],
            ny: [7, 9],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 1],
            py: [3, 3],
            pz: [2, 2],
            nx: [2, 2],
            ny: [15, 16],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [17, 18],
            py: [5, 5],
            pz: [0, 0],
            nx: [9, 21],
            ny: [2, 10],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [14, 7],
            pz: [0, 1],
            nx: [3, 4],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 3],
            py: [3, 1],
            pz: [1, -1],
            nx: [19, 10],
            ny: [12, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [6, 16],
            py: [3, 8],
            pz: [1, 0],
            nx: [8, 10],
            ny: [20, 4],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [5, 5, 2],
            py: [21, 8, 4],
            pz: [0, 1, 2],
            nx: [10, 6, 3],
            ny: [15, 2, 1],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [11, 10],
            py: [10, 12],
            pz: [0, 0],
            nx: [11, 11],
            ny: [2, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [3, 2],
            pz: [1, 1],
            nx: [8, 11],
            ny: [3, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 3],
            py: [5, 8],
            pz: [0, -1],
            nx: [12, 3],
            ny: [3, 1],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [13, 7],
            py: [2, 1],
            pz: [0, 1],
            nx: [5, 5],
            ny: [1, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 10],
            py: [10, 8],
            pz: [0, -1],
            nx: [14, 16],
            ny: [10, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 10],
            py: [7, 8],
            pz: [1, -1],
            nx: [2, 6],
            ny: [5, 6],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [1, 8],
            pz: [0, -1],
            nx: [2, 2],
            ny: [3, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [4, 0],
            py: [5, 2],
            pz: [1, -1],
            nx: [1, 2],
            ny: [2, 3],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [1, 12],
            py: [1, 9],
            pz: [2, -1],
            nx: [16, 17],
            ny: [3, 3],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 6],
            py: [5, 8],
            pz: [0, -1],
            nx: [3, 4],
            ny: [7, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [14, 3],
            py: [11, 5],
            pz: [0, -1],
            nx: [11, 4],
            ny: [0, 0],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [6, 10],
            py: [6, 6],
            pz: [1, -1],
            nx: [0, 0],
            ny: [1, 0],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [3, 7],
            py: [0, 7],
            pz: [1, -1],
            nx: [15, 13],
            ny: [8, 4],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [18, 1],
            py: [15, 0],
            pz: [0, -1],
            nx: [18, 18],
            ny: [18, 17],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [5, 2],
            py: [4, 4],
            pz: [0, -1],
            nx: [4, 18],
            ny: [4, 15],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [3, 14, 13],
            py: [2, 7, 8],
            pz: [2, 0, 0],
            nx: [10, 0, 2],
            ny: [8, 3, 2],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [16, 0],
            py: [14, 3],
            pz: [0, -1],
            nx: [18, 3],
            ny: [12, 5],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [5, 3],
            py: [8, 3],
            pz: [1, 2],
            nx: [13, 4],
            ny: [10, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [1, 2],
            pz: [2, 1],
            nx: [8, 1],
            ny: [4, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [8, 3],
            pz: [1, -1],
            nx: [12, 7],
            ny: [2, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [17, 3],
            py: [9, 2],
            pz: [0, 2],
            nx: [7, 6],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [12, 1],
            py: [2, 1],
            pz: [0, -1],
            nx: [4, 4],
            ny: [2, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [22, 5],
            py: [15, 3],
            pz: [0, 2],
            nx: [16, 17],
            ny: [14, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 11],
            py: [19, 13],
            pz: [0, -1],
            nx: [0, 0],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [8, 11],
            py: [8, 1],
            pz: [1, -1],
            nx: [3, 3],
            ny: [2, 5],
            nz: [1, 2]
          },
          {
            size: 3,
            px: [3, 8, 0],
            py: [7, 7, 5],
            pz: [1, -1, -1],
            nx: [11, 5, 1],
            ny: [11, 7, 5],
            nz: [0, 1, 1]
          },
          {
            size: 2,
            px: [12, 6],
            py: [12, 6],
            pz: [0, 1],
            nx: [9, 0],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [16, 12],
            py: [7, 1],
            pz: [0, -1],
            nx: [16, 7],
            ny: [6, 4],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [13, 5],
            py: [14, 0],
            pz: [0, -1],
            nx: [13, 10],
            ny: [0, 0],
            nz: [0, 0]
          },
          {
            size: 5,
            px: [11, 12, 13, 12, 7],
            py: [0, 1, 0, 0, 0],
            pz: [0, 0, 0, 0, 1],
            nx: [13, 16, 14, 4, 4],
            ny: [18, 23, 18, 5, 5],
            nz: [0, 0, 0, 2, -1]
          },
          {
            size: 2,
            px: [14, 5],
            py: [12, 4],
            pz: [0, -1],
            nx: [7, 7],
            ny: [8, 2],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [19, 3],
            py: [2, 5],
            pz: [0, -1],
            nx: [11, 23],
            ny: [7, 13],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [0, 0],
            py: [19, 20],
            pz: [0, 0],
            nx: [9, 4],
            ny: [5, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [15, 4],
            py: [12, 3],
            pz: [0, 2],
            nx: [9, 5],
            ny: [4, 5],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [8, 0, 1, 21],
            py: [6, 0, 7, 16],
            pz: [1, -1, -1, -1],
            nx: [11, 6, 11, 5],
            ny: [8, 6, 4, 3],
            nz: [1, 1, 1, 2]
          },
          {
            size: 2,
            px: [11, 11],
            py: [7, 5],
            pz: [0, -1],
            nx: [9, 10],
            ny: [6, 7],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 4],
            py: [1, 2],
            pz: [2, 1],
            nx: [16, 6],
            ny: [0, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 3],
            pz: [1, 2],
            nx: [1, 21],
            ny: [23, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [7, 0],
            pz: [0, -1],
            nx: [4, 13],
            ny: [4, 10],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [11, 4],
            py: [0, 4],
            pz: [1, -1],
            nx: [4, 2],
            ny: [16, 8],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [5, 3],
            py: [12, 6],
            pz: [0, 1],
            nx: [3, 3],
            ny: [4, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [19, 11],
            pz: [0, -1],
            nx: [9, 5],
            ny: [21, 9],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [17, 9],
            pz: [0, 1],
            nx: [0, 5],
            ny: [0, 9],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [4, 5],
            py: [2, 4],
            pz: [0, -1],
            nx: [4, 4],
            ny: [5, 6],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [1, 0],
            pz: [1, 2],
            nx: [4, 3],
            ny: [3, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 0],
            py: [7, 2],
            pz: [1, -1],
            nx: [5, 5],
            ny: [1, 0],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [13, 0],
            py: [17, 2],
            pz: [0, -1],
            nx: [3, 6],
            ny: [5, 8],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [2, 1],
            py: [0, 5],
            pz: [2, -1],
            nx: [4, 9],
            ny: [2, 7],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [13, 8],
            pz: [0, -1],
            nx: [23, 11],
            ny: [13, 7],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [0, 2],
            pz: [1, 0],
            nx: [3, 6],
            ny: [11, 18],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [6, 5],
            pz: [0, -1],
            nx: [1, 1],
            ny: [1, 3],
            nz: [2, 1]
          },
          {
            size: 4,
            px: [3, 6, 3, 6],
            py: [3, 6, 2, 5],
            pz: [2, 1, 2, 1],
            nx: [0, 4, 1, 1],
            ny: [0, 22, 17, 0],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [8, 4],
            py: [6, 3],
            pz: [1, 2],
            nx: [9, 15],
            ny: [4, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [8, 18],
            py: [7, 8],
            pz: [1, 0],
            nx: [8, 5],
            ny: [4, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [4, 5],
            pz: [1, -1],
            nx: [5, 6],
            ny: [0, 0],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [13, 18],
            py: [23, 19],
            pz: [0, 0],
            nx: [7, 13],
            ny: [10, 20],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 6],
            py: [2, 0],
            pz: [0, 1],
            nx: [4, 1],
            ny: [5, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [1, 1],
            py: [5, 4],
            pz: [2, 2],
            nx: [0, 20],
            ny: [4, 4],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [5, 5],
            py: [1, 0],
            pz: [2, 2],
            nx: [12, 6],
            ny: [18, 11],
            nz: [0, -1]
          },
          {
            size: 5,
            px: [2, 1, 3, 1, 5],
            py: [3, 3, 7, 4, 9],
            pz: [2, 2, 1, 2, 1],
            nx: [9, 3, 8, 16, 10],
            ny: [5, 3, 10, 6, 7],
            nz: [1, -1, -1, -1, -1]
          },
          {
            size: 2,
            px: [4, 1],
            py: [12, 3],
            pz: [0, -1],
            nx: [10, 1],
            ny: [11, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [19, 0],
            py: [10, 7],
            pz: [0, -1],
            nx: [14, 7],
            ny: [6, 3],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [7, 4],
            py: [2, 1],
            pz: [1, 2],
            nx: [6, 0],
            ny: [2, 18],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [14, 8],
            py: [3, 0],
            pz: [0, 1],
            nx: [17, 1],
            ny: [1, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [18, 19],
            py: [1, 17],
            pz: [0, -1],
            nx: [5, 11],
            ny: [2, 5],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [12, 12, 12, 6, 12],
            py: [10, 11, 12, 6, 9],
            pz: [0, 0, 0, 1, 0],
            nx: [13, 3, 12, 6, 6],
            ny: [4, 1, 4, 2, 2],
            nz: [0, 2, 0, 1, -1]
          },
          {
            size: 2,
            px: [11, 10],
            py: [3, 3],
            pz: [0, 0],
            nx: [4, 9],
            ny: [4, 17],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 0],
            py: [13, 5],
            pz: [0, 2],
            nx: [8, 18],
            ny: [15, 15],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [3, 4],
            py: [6, 5],
            pz: [1, 1],
            nx: [0, 0],
            ny: [9, 4],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [1, 0],
            pz: [2, 2],
            nx: [2, 15],
            ny: [2, 1],
            nz: [2, -1]
          },
          {
            size: 3,
            px: [2, 4, 2],
            py: [4, 9, 5],
            pz: [2, 1, 2],
            nx: [2, 5, 14],
            ny: [0, 1, 4],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [11, 12],
            py: [20, 20],
            pz: [0, 0],
            nx: [6, 10],
            ny: [9, 19],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 0],
            py: [16, 8],
            pz: [0, -1],
            nx: [2, 3],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 5,
            px: [16, 17, 15, 16, 15],
            py: [1, 1, 1, 0, 0],
            pz: [0, 0, 0, 0, 0],
            nx: [8, 8, 4, 12, 12],
            ny: [8, 7, 2, 23, 23],
            nz: [1, 1, 2, 0, -1]
          },
          {
            size: 2,
            px: [2, 4],
            py: [6, 12],
            pz: [1, -1],
            nx: [8, 13],
            ny: [1, 1],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [9, 2],
            py: [3, 2],
            pz: [0, -1],
            nx: [3, 4],
            ny: [6, 5],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 8],
            py: [6, 1],
            pz: [1, -1],
            nx: [11, 8],
            ny: [2, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [9, 3],
            py: [7, 0],
            pz: [1, -1],
            nx: [19, 19],
            ny: [18, 16],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 2],
            py: [1, 1],
            pz: [2, 2],
            nx: [22, 11],
            ny: [4, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 10],
            py: [9, 8],
            pz: [1, 1],
            nx: [4, 4],
            ny: [10, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 1],
            py: [0, 5],
            pz: [0, -1],
            nx: [10, 8],
            ny: [2, 2],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 3],
            py: [8, 7],
            pz: [1, 1],
            nx: [8, 2],
            ny: [8, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 5],
            py: [21, 3],
            pz: [0, -1],
            nx: [13, 3],
            ny: [20, 5],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [12, 5],
            py: [11, 2],
            pz: [0, -1],
            nx: [1, 0],
            ny: [19, 9],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [7, 10],
            py: [9, 10],
            pz: [1, 1],
            nx: [8, 4],
            ny: [10, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 9],
            pz: [2, 1],
            nx: [2, 11],
            ny: [9, 19],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 5],
            py: [1, 2],
            pz: [2, 1],
            nx: [8, 23],
            ny: [4, 9],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 4],
            py: [2, 4],
            pz: [2, 1],
            nx: [5, 9],
            ny: [2, 5],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [2, 3],
            pz: [1, 1],
            nx: [19, 9],
            ny: [6, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [9, 4],
            py: [5, 10],
            pz: [1, -1],
            nx: [10, 22],
            ny: [0, 16],
            nz: [1, 0]
          },
          {
            size: 3,
            px: [19, 9, 19],
            py: [3, 1, 2],
            pz: [0, 1, 0],
            nx: [6, 3, 6],
            ny: [10, 3, 0],
            nz: [1, -1, -1]
          },
          {
            size: 2,
            px: [8, 3],
            py: [10, 3],
            pz: [1, 2],
            nx: [23, 14],
            ny: [3, 18],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 11],
            py: [19, 0],
            pz: [0, -1],
            nx: [4, 16],
            ny: [4, 11],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [22, 23],
            py: [3, 22],
            pz: [0, -1],
            nx: [9, 3],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [7, 2],
            py: [12, 4],
            pz: [0, -1],
            nx: [8, 4],
            ny: [10, 5],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [12, 13],
            py: [5, 13],
            pz: [0, -1],
            nx: [11, 3],
            ny: [2, 0],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [3, 17],
            py: [0, 16],
            pz: [1, -1],
            nx: [12, 12],
            ny: [5, 6],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [4, 3],
            py: [1, 0],
            pz: [2, 2],
            nx: [4, 3],
            ny: [0, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 3],
            py: [12, 0],
            pz: [0, -1],
            nx: [12, 12],
            ny: [13, 12],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [13, 4],
            py: [11, 14],
            pz: [0, -1],
            nx: [0, 0],
            ny: [4, 6],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [8, 7],
            py: [7, 8],
            pz: [1, 1],
            nx: [3, 0],
            ny: [5, 21],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [1, 3],
            py: [4, 14],
            pz: [2, 0],
            nx: [8, 8],
            ny: [7, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 11],
            py: [20, 7],
            pz: [0, -1],
            nx: [21, 21],
            ny: [20, 18],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 1],
            py: [11, 0],
            pz: [0, -1],
            nx: [2, 2],
            ny: [15, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [10, 1],
            py: [8, 0],
            pz: [1, -1],
            nx: [8, 4],
            ny: [7, 4],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [17, 6],
            py: [13, 1],
            pz: [0, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [7, 15],
            py: [1, 3],
            pz: [1, 0],
            nx: [15, 5],
            ny: [1, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 1],
            py: [20, 10],
            pz: [0, -1],
            nx: [6, 8],
            ny: [11, 10],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [7, 14],
            py: [0, 0],
            pz: [1, 0],
            nx: [7, 8],
            ny: [7, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [17, 4],
            pz: [0, -1],
            nx: [12, 5],
            ny: [16, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [13, 3],
            py: [15, 0],
            pz: [0, -1],
            nx: [12, 7],
            ny: [17, 8],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [7, 1],
            py: [14, 1],
            pz: [0, -1],
            nx: [4, 6],
            ny: [6, 12],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [8, 7],
            py: [0, 0],
            pz: [0, 0],
            nx: [6, 20],
            ny: [5, 5],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 2],
            py: [22, 5],
            pz: [0, -1],
            nx: [4, 8],
            ny: [4, 9],
            nz: [2, 1]
          },
          {
            size: 4,
            px: [8, 2, 2, 9],
            py: [6, 5, 3, 11],
            pz: [1, -1, -1, -1],
            nx: [2, 7, 4, 3],
            ny: [2, 1, 0, 2],
            nz: [2, 0, 1, 2]
          },
          {
            size: 2,
            px: [12, 6],
            py: [12, 6],
            pz: [0, 1],
            nx: [8, 2],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [13, 11],
            py: [19, 8],
            pz: [0, -1],
            nx: [13, 13],
            ny: [20, 17],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [11, 19],
            py: [5, 14],
            pz: [0, -1],
            nx: [3, 4],
            ny: [8, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [10, 0],
            py: [8, 6],
            pz: [1, -1],
            nx: [21, 21],
            ny: [16, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [1, 12],
            py: [7, 6],
            pz: [1, -1],
            nx: [2, 7],
            ny: [5, 14],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [2, 9],
            py: [7, 5],
            pz: [1, -1],
            nx: [2, 5],
            ny: [5, 9],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [12, 5],
            py: [15, 6],
            pz: [0, -1],
            nx: [3, 12],
            ny: [0, 2],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [23, 22],
            py: [23, 1],
            pz: [0, -1],
            nx: [0, 0],
            ny: [2, 3],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [3, 6],
            py: [1, 2],
            pz: [2, 1],
            nx: [8, 0],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 1],
            py: [9, 1],
            pz: [0, -1],
            nx: [4, 2],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [0, 1],
            py: [0, 0],
            pz: [2, 0],
            nx: [2, 3],
            ny: [9, 10],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 0],
            py: [16, 14],
            pz: [0, -1],
            nx: [6, 3],
            ny: [23, 14],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 3],
            py: [2, 3],
            pz: [2, 1],
            nx: [13, 3],
            ny: [19, 14],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [8, 18],
            pz: [0, -1],
            nx: [4, 7],
            ny: [1, 2],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [4, 4],
            py: [5, 6],
            pz: [1, 1],
            nx: [2, 2],
            ny: [5, 3],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [7, 3],
            py: [13, 7],
            pz: [0, 1],
            nx: [4, 3],
            ny: [4, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [5, 6],
            pz: [1, 0],
            nx: [2, 1],
            ny: [5, 1],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 14],
            py: [3, 5],
            pz: [1, 0],
            nx: [5, 0],
            ny: [16, 7],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 2],
            py: [18, 5],
            pz: [0, 2],
            nx: [11, 4],
            ny: [16, 4],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [6, 16],
            py: [19, 20],
            pz: [0, -1],
            nx: [3, 2],
            ny: [10, 5],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [5, 3],
            py: [3, 1],
            pz: [0, 1],
            nx: [1, 3],
            ny: [4, 8],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [12, 6],
            py: [13, 6],
            pz: [0, 1],
            nx: [10, 1],
            ny: [12, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 3],
            py: [6, 2],
            pz: [1, -1],
            nx: [4, 8],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [9, 3],
            py: [21, 2],
            pz: [0, -1],
            nx: [8, 4],
            ny: [1, 0],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [8, 4],
            py: [1, 0],
            pz: [1, -1],
            nx: [8, 6],
            ny: [4, 2],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [2, 7],
            py: [1, 6],
            pz: [2, -1],
            nx: [7, 9],
            ny: [6, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [8, 3],
            pz: [1, 2],
            nx: [10, 5],
            ny: [19, 11],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [2, 2],
            py: [3, 4],
            pz: [2, 2],
            nx: [3, 6],
            ny: [4, 6],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [3, 11],
            py: [5, 20],
            pz: [2, 0],
            nx: [11, 5],
            ny: [21, 8],
            nz: [0, -1]
          },
          {
            size: 3,
            px: [5, 9, 5],
            py: [4, 7, 5],
            pz: [2, 0, 2],
            nx: [23, 10, 4],
            ny: [23, 3, 22],
            nz: [0, -1, -1]
          },
          {
            size: 4,
            px: [11, 9, 7, 1],
            py: [13, 8, 11, 10],
            pz: [0, -1, -1, -1],
            nx: [8, 2, 11, 12],
            ny: [4, 2, 4, 4],
            nz: [1, 2, 0, 0]
          },
          {
            size: 2,
            px: [0, 0],
            py: [7, 6],
            pz: [1, 1],
            nx: [0, 4],
            ny: [1, 0],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [19, 20],
            py: [0, 1],
            pz: [0, 0],
            nx: [21, 1],
            ny: [0, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 5],
            py: [11, 0],
            pz: [0, -1],
            nx: [11, 0],
            ny: [12, 1],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [11, 11],
            py: [1, 1],
            pz: [0, -1],
            nx: [4, 7],
            ny: [5, 4],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [5, 12],
            py: [4, 23],
            pz: [2, -1],
            nx: [13, 15],
            ny: [5, 4],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 20],
            py: [4, 16],
            pz: [0, -1],
            nx: [9, 4],
            ny: [2, 1],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [12, 13],
            py: [2, 2],
            pz: [0, 0],
            nx: [4, 16],
            ny: [2, 11],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [19, 14],
            py: [10, 17],
            pz: [0, -1],
            nx: [3, 8],
            ny: [0, 2],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [8, 12],
            py: [1, 2],
            pz: [1, 0],
            nx: [19, 10],
            ny: [3, 1],
            nz: [0, -1]
          },
          {
            size: 4,
            px: [17, 2, 3, 10],
            py: [8, 6, 2, 12],
            pz: [0, 1, 2, 0],
            nx: [17, 9, 12, 2],
            ny: [9, 22, 13, 5],
            nz: [0, -1, -1, -1]
          },
          {
            size: 2,
            px: [20, 10],
            py: [15, 7],
            pz: [0, 1],
            nx: [13, 9],
            ny: [7, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [0, 0],
            py: [1, 0],
            pz: [2, 2],
            nx: [10, 3],
            ny: [9, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [4, 3],
            py: [1, 0],
            pz: [2, 2],
            nx: [0, 22],
            ny: [14, 6],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 3],
            py: [4, 0],
            pz: [0, 2],
            nx: [16, 3],
            ny: [2, 0],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [8, 16],
            py: [6, 12],
            pz: [1, 0],
            nx: [8, 12],
            ny: [4, 7],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [5, 11],
            py: [0, 5],
            pz: [2, 1],
            nx: [10, 1],
            ny: [5, 5],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [7, 4],
            py: [5, 5],
            pz: [0, -1],
            nx: [3, 6],
            ny: [2, 3],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [11, 11],
            py: [11, 12],
            pz: [0, 0],
            nx: [23, 7],
            ny: [20, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [16, 8],
            py: [12, 5],
            pz: [0, 1],
            nx: [8, 2],
            ny: [2, 1],
            nz: [1, -1]
          },
          {
            size: 3,
            px: [6, 11, 11],
            py: [11, 23, 20],
            pz: [1, 0, 0],
            nx: [11, 3, 22],
            ny: [21, 3, 16],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [17, 15],
            py: [3, 2],
            pz: [0, -1],
            nx: [4, 4],
            ny: [3, 2],
            nz: [2, 2]
          },
          {
            size: 2,
            px: [21, 21],
            py: [11, 10],
            pz: [0, 0],
            nx: [11, 3],
            ny: [6, 2],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [23, 21],
            py: [22, 10],
            pz: [0, -1],
            nx: [20, 10],
            ny: [18, 10],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [4, 2],
            py: [6, 3],
            pz: [1, 2],
            nx: [3, 2],
            ny: [4, 3],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [16, 0],
            py: [18, 11],
            pz: [0, -1],
            nx: [8, 7],
            ny: [4, 4],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [6, 21],
            py: [3, 16],
            pz: [0, -1],
            nx: [1, 8],
            ny: [2, 14],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [8, 1],
            py: [3, 0],
            pz: [0, -1],
            nx: [11, 11],
            ny: [2, 1],
            nz: [0, 0]
          },
          {
            size: 3,
            px: [11, 11, 11],
            py: [9, 10, 8],
            pz: [1, 1, 1],
            nx: [23, 1, 0],
            ny: [23, 9, 11],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [6, 3],
            py: [2, 1],
            pz: [1, 2],
            nx: [7, 1],
            ny: [8, 2],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 17],
            py: [17, 19],
            pz: [0, -1],
            nx: [10, 4],
            ny: [16, 9],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [7, 1],
            pz: [1, -1],
            nx: [11, 0],
            ny: [11, 8],
            nz: [0, 1]
          },
          {
            size: 2,
            px: [10, 5],
            py: [11, 4],
            pz: [1, 2],
            nx: [5, 5],
            ny: [0, 0],
            nz: [2, -1]
          },
          {
            size: 2,
            px: [3, 6],
            py: [3, 6],
            pz: [2, 1],
            nx: [8, 0],
            ny: [4, 16],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [14, 1],
            py: [20, 2],
            pz: [0, -1],
            nx: [7, 7],
            ny: [11, 9],
            nz: [1, 1]
          },
          {
            size: 3,
            px: [11, 13, 4],
            py: [16, 21, 3],
            pz: [0, 0, 2],
            nx: [14, 16, 5],
            ny: [20, 14, 9],
            nz: [0, -1, -1]
          },
          {
            size: 2,
            px: [7, 0],
            py: [1, 1],
            pz: [1, -1],
            nx: [4, 7],
            ny: [2, 4],
            nz: [2, 1]
          },
          {
            size: 2,
            px: [23, 11],
            py: [9, 4],
            pz: [0, 1],
            nx: [11, 3],
            ny: [1, 3],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 13],
            py: [23, 23],
            pz: [0, 0],
            nx: [13, 13],
            ny: [20, 20],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [10, 8],
            py: [5, 11],
            pz: [0, -1],
            nx: [20, 19],
            ny: [18, 20],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [19, 5],
            py: [22, 4],
            pz: [0, -1],
            nx: [2, 9],
            ny: [3, 17],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [15, 2],
            py: [13, 7],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 2,
            px: [14, 13],
            py: [17, 2],
            pz: [0, -1],
            nx: [15, 13],
            ny: [19, 15],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [12, 23],
            py: [8, 22],
            pz: [0, -1],
            nx: [7, 10],
            ny: [5, 9],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [2, 6],
            py: [21, 10],
            pz: [0, -1],
            nx: [3, 4],
            ny: [3, 3],
            nz: [1, 1]
          },
          {
            size: 2,
            px: [15, 11],
            py: [5, 0],
            pz: [0, -1],
            nx: [3, 4],
            ny: [17, 16],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [3, 1],
            py: [18, 8],
            pz: [0, 1],
            nx: [14, 4],
            ny: [17, 7],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [15, 3],
            py: [18, 3],
            pz: [0, 2],
            nx: [1, 22],
            ny: [0, 1],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [13, 3],
            py: [9, 3],
            pz: [0, -1],
            nx: [0, 1],
            ny: [9, 20],
            nz: [1, 0]
          },
          {
            size: 2,
            px: [1, 1],
            py: [1, 0],
            pz: [2, 2],
            nx: [9, 23],
            ny: [10, 12],
            nz: [1, -1]
          },
          {
            size: 4,
            px: [9, 0, 9, 1],
            py: [8, 0, 0, 10],
            pz: [1, -1, -1, -1],
            nx: [23, 7, 5, 23],
            ny: [20, 7, 5, 19],
            nz: [0, 1, 2, 0]
          },
          {
            size: 2,
            px: [18, 18],
            py: [12, 12],
            pz: [0, -1],
            nx: [8, 4],
            ny: [4, 2],
            nz: [1, 2]
          },
          {
            size: 3,
            px: [0, 4, 1],
            py: [3, 5, 3],
            pz: [1, -1, -1],
            nx: [16, 11, 8],
            ny: [8, 5, 6],
            nz: [0, 0, 0]
          },
          {
            size: 5,
            px: [9, 10, 14, 11, 11],
            py: [0, 0, 0, 0, 0],
            pz: [0, 0, 0, 0, -1],
            nx: [8, 3, 4, 6, 2],
            ny: [22, 9, 5, 4, 0],
            nz: [0, 1, 0, 0, 2]
          },
          {
            size: 2,
            px: [6, 5],
            py: [2, 2],
            pz: [1, 1],
            nx: [7, 3],
            ny: [8, 7],
            nz: [0, -1]
          },
          {
            size: 2,
            px: [11, 5],
            py: [15, 2],
            pz: [0, -1],
            nx: [3, 10],
            ny: [0, 1],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [0, 11],
            py: [11, 12],
            pz: [1, -1],
            nx: [22, 22],
            ny: [14, 13],
            nz: [0, 0]
          },
          {
            size: 2,
            px: [2, 2],
            py: [15, 14],
            pz: [0, 0],
            nx: [1, 2],
            ny: [11, 8],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [11, 6],
            py: [0, 7],
            pz: [1, -1],
            nx: [19, 5],
            ny: [3, 0],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [2, 3],
            py: [3, 7],
            pz: [2, 1],
            nx: [1, 5],
            ny: [5, 0],
            nz: [1, -1]
          },
          {
            size: 2,
            px: [10, 14],
            py: [4, 5],
            pz: [0, -1],
            nx: [4, 18],
            ny: [2, 12],
            nz: [2, 0]
          },
          {
            size: 2,
            px: [19, 10],
            py: [12, 2],
            pz: [0, -1],
            nx: [13, 4],
            ny: [10, 2],
            nz: [0, 2]
          },
          {
            size: 2,
            px: [6, 1],
            py: [21, 6],
            pz: [0, -1],
            nx: [6, 5],
            ny: [0, 0],
            nz: [1, 1]
          }
        ],
        alpha: [
          -1.044179,
          1.044179,
          -6.003138e-1,
          6.003138e-1,
          -4.091282e-1,
          4.091282e-1,
          -4.590148e-1,
          4.590148e-1,
          -4.294004e-1,
          4.294004e-1,
          -3.360846e-1,
          3.360846e-1,
          -3.054186e-1,
          3.054186e-1,
          -2.901743e-1,
          2.901743e-1,
          -3.522417e-1,
          3.522417e-1,
          -3.195838e-1,
          3.195838e-1,
          -2.957309e-1,
          2.957309e-1,
          -2.876727e-1,
          2.876727e-1,
          -2.63746e-1,
          2.63746e-1,
          -2.6079e-1,
          2.6079e-1,
          -2.455714e-1,
          2.455714e-1,
          -2.749847e-1,
          2.749847e-1,
          -2.314217e-1,
          2.314217e-1,
          -2.540871e-1,
          2.540871e-1,
          -2.143416e-1,
          2.143416e-1,
          -2.565697e-1,
          2.565697e-1,
          -1.901272e-1,
          1.901272e-1,
          -2.259981e-1,
          2.259981e-1,
          -2.012333e-1,
          2.012333e-1,
          -2.44846e-1,
          2.44846e-1,
          -2.192845e-1,
          2.192845e-1,
          -2.005951e-1,
          2.005951e-1,
          -2.259e-1,
          2.259e-1,
          -1.955758e-1,
          1.955758e-1,
          -2.235332e-1,
          2.235332e-1,
          -1.70449e-1,
          1.70449e-1,
          -1.584628e-1,
          1.584628e-1,
          -2.16771e-1,
          2.16771e-1,
          -1.592909e-1,
          1.592909e-1,
          -1.967292e-1,
          1.967292e-1,
          -1.432268e-1,
          1.432268e-1,
          -2.039949e-1,
          2.039949e-1,
          -1.404068e-1,
          1.404068e-1,
          -1.788201e-1,
          1.788201e-1,
          -1.498714e-1,
          1.498714e-1,
          -1.282541e-1,
          1.282541e-1,
          -1.630182e-1,
          1.630182e-1,
          -1.398111e-1,
          1.398111e-1,
          -1.464143e-1,
          1.464143e-1,
          -1.281712e-1,
          1.281712e-1,
          -1.417014e-1,
          1.417014e-1,
          -1.779164e-1,
          1.779164e-1,
          -2.067174e-1,
          2.067174e-1,
          -1.344947e-1,
          1.344947e-1,
          -1.357351e-1,
          1.357351e-1,
          -1.683191e-1,
          1.683191e-1,
          -1.821768e-1,
          1.821768e-1,
          -2.158307e-1,
          2.158307e-1,
          -1.812857e-1,
          1.812857e-1,
          -1.635445e-1,
          1.635445e-1,
          -1.474934e-1,
          1.474934e-1,
          -1.771993e-1,
          1.771993e-1,
          -1.51762e-1,
          1.51762e-1,
          -1.283184e-1,
          1.283184e-1,
          -1.862675e-1,
          1.862675e-1,
          -1.420491e-1,
          1.420491e-1,
          -1.232165e-1,
          1.232165e-1,
          -1.472696e-1,
          1.472696e-1,
          -1.192156e-1,
          1.192156e-1,
          -1.602034e-1,
          1.602034e-1,
          -1.321473e-1,
          1.321473e-1,
          -1.358101e-1,
          1.358101e-1,
          -1.295821e-1,
          1.295821e-1,
          -1.289102e-1,
          1.289102e-1,
          -1.23252e-1,
          1.23252e-1,
          -1.332227e-1,
          1.332227e-1,
          -1.358887e-1,
          1.358887e-1,
          -1.179559e-1,
          1.179559e-1,
          -1.263694e-1,
          1.263694e-1,
          -1.444876e-1,
          1.444876e-1,
          -1.933141e-1,
          1.933141e-1,
          -1.917886e-1,
          1.917886e-1,
          -1.19976e-1,
          1.19976e-1,
          -1.359937e-1,
          1.359937e-1,
          -1.690073e-1,
          1.690073e-1,
          -1.894222e-1,
          1.894222e-1,
          -1.699422e-1,
          1.699422e-1,
          -1.340361e-1,
          1.340361e-1,
          -1.840622e-1,
          1.840622e-1,
          -1.277397e-1,
          1.277397e-1,
          -1.38161e-1,
          1.38161e-1,
          -1.282241e-1,
          1.282241e-1,
          -1.211334e-1,
          1.211334e-1,
          -1.264628e-1,
          1.264628e-1,
          -1.37301e-1,
          1.37301e-1,
          -1.363356e-1,
          1.363356e-1,
          -1.562568e-1,
          1.562568e-1,
          -1.268735e-1,
          1.268735e-1,
          -1.037859e-1,
          1.037859e-1,
          -1.394322e-1,
          1.394322e-1,
          -1.449225e-1,
          1.449225e-1,
          -1.109657e-1,
          1.109657e-1,
          -1.086931e-1,
          1.086931e-1,
          -1.379135e-1,
          1.379135e-1,
          -1.881974e-1,
          1.881974e-1,
          -1.304956e-1,
          1.304956e-1,
          -9.921777e-2,
          9.921777e-2,
          -1.398624e-1,
          1.398624e-1,
          -1.216469e-1,
          1.216469e-1,
          -1.272741e-1,
          1.272741e-1,
          -1.878236e-1,
          1.878236e-1,
          -1.336894e-1,
          1.336894e-1,
          -1.256289e-1,
          1.256289e-1,
          -1.247231e-1,
          1.247231e-1,
          -1.8534e-1,
          1.8534e-1,
          -1.087805e-1,
          1.087805e-1,
          -1.205676e-1,
          1.205676e-1,
          -1.023182e-1,
          1.023182e-1,
          -1.268422e-1,
          1.268422e-1,
          -1.4229e-1,
          1.4229e-1,
          -1.098174e-1,
          1.098174e-1,
          -1.317018e-1,
          1.317018e-1,
          -1.378142e-1,
          1.378142e-1,
          -1.27455e-1,
          1.27455e-1,
          -1.142944e-1,
          1.142944e-1,
          -1.713488e-1,
          1.713488e-1,
          -1.103035e-1,
          1.103035e-1,
          -1.045221e-1,
          1.045221e-1,
          -1.293015e-1,
          1.293015e-1,
          -9.763183e-2,
          9.763183e-2,
          -1.387213e-1,
          1.387213e-1,
          -9.031167e-2,
          9.031167e-2,
          -1.283052e-1,
          1.283052e-1,
          -1.133462e-1,
          1.133462e-1,
          -9.370681e-2,
          9.370681e-2,
          -1.079269e-1,
          1.079269e-1,
          -1.331913e-1,
          1.331913e-1,
          -8.969902e-2,
          8.969902e-2,
          -1.04456e-1,
          1.04456e-1,
          -9.387466e-2,
          9.387466e-2,
          -1.208988e-1,
          1.208988e-1,
          -1.252011e-1,
          1.252011e-1,
          -1.401277e-1,
          1.401277e-1,
          -1.461381e-1,
          1.461381e-1,
          -1.323763e-1,
          1.323763e-1,
          -9.923889e-2,
          9.923889e-2,
          -1.142899e-1,
          1.142899e-1,
          -9.110853e-2,
          9.110853e-2,
          -1.106607e-1,
          1.106607e-1,
          -1.25314e-1,
          1.25314e-1,
          -9.657895e-2,
          9.657895e-2,
          -1.03001e-1,
          1.03001e-1,
          -1.348857e-1,
          1.348857e-1,
          -1.237793e-1,
          1.237793e-1,
          -1.296943e-1,
          1.296943e-1,
          -1.323385e-1,
          1.323385e-1,
          -8.331554e-2,
          8.331554e-2,
          -8.417589e-2,
          8.417589e-2,
          -1.104431e-1,
          1.104431e-1,
          -1.17071e-1,
          1.17071e-1,
          -1.391725e-1,
          1.391725e-1,
          -1.485189e-1,
          1.485189e-1,
          -1.840393e-1,
          1.840393e-1,
          -1.23825e-1,
          1.23825e-1,
          -1.095287e-1,
          1.095287e-1,
          -1.177869e-1,
          1.177869e-1,
          -1.036409e-1,
          1.036409e-1,
          -9.802581e-2,
          9.802581e-2,
          -9.364054e-2,
          9.364054e-2,
          -9.936022e-2,
          9.936022e-2,
          -1.117201e-1,
          1.117201e-1,
          -1.0813e-1,
          1.0813e-1,
          -1.331861e-1,
          1.331861e-1,
          -1.192122e-1,
          1.192122e-1,
          -9.889761e-2,
          9.889761e-2,
          -1.173456e-1,
          1.173456e-1,
          -1.032917e-1,
          1.032917e-1,
          -9.268551e-2,
          9.268551e-2,
          -1.178563e-1,
          1.178563e-1,
          -1.215065e-1,
          1.215065e-1,
          -1.060437e-1,
          1.060437e-1,
          -1.010044e-1,
          1.010044e-1,
          -1.021683e-1,
          1.021683e-1,
          -9.974968e-2,
          9.974968e-2,
          -1.161528e-1,
          1.161528e-1,
          -8.686721e-2,
          8.686721e-2,
          -8.145259e-2,
          8.145259e-2,
          -9.93706e-2,
          9.93706e-2,
          -1.170885e-1,
          1.170885e-1,
          -7.693779e-2,
          7.693779e-2,
          -9.047233e-2,
          9.047233e-2,
          -9.168442e-2,
          9.168442e-2,
          -1.054105e-1,
          1.054105e-1,
          -9.036177e-2,
          9.036177e-2,
          -1.251949e-1,
          1.251949e-1,
          -9.523847e-2,
          9.523847e-2,
          -1.03893e-1,
          1.03893e-1,
          -1.43366e-1,
          1.43366e-1,
          -1.48983e-1,
          1.48983e-1,
          -8.393174e-2,
          8.393174e-2,
          -8.888026e-2,
          8.888026e-2,
          -9.347861e-2,
          9.347861e-2,
          -1.044838e-1,
          1.044838e-1,
          -1.102144e-1,
          1.102144e-1,
          -1.383415e-1,
          1.383415e-1,
          -1.466476e-1,
          1.466476e-1,
          -1.129741e-1,
          1.129741e-1,
          -1.310915e-1,
          1.310915e-1,
          -1.070648e-1,
          1.070648e-1,
          -7.559007e-2,
          7.559007e-2,
          -8.812082e-2,
          8.812082e-2,
          -1.234272e-1,
          1.234272e-1,
          -1.088022e-1,
          1.088022e-1,
          -8.388703e-2,
          8.388703e-2,
          -7.179593e-2,
          7.179593e-2,
          -1.008961e-1,
          1.008961e-1,
          -9.03007e-2,
          9.03007e-2,
          -8.581345e-2,
          8.581345e-2,
          -9.023431e-2,
          9.023431e-2,
          -9.807321e-2,
          9.807321e-2,
          -9.621402e-2,
          9.621402e-2,
          -1.730195e-1,
          1.730195e-1,
          -8.984631e-2,
          8.984631e-2,
          -9.556661e-2,
          9.556661e-2,
          -1.047576e-1,
          1.047576e-1,
          -7.854313e-2,
          7.854313e-2,
          -8.682118e-2,
          8.682118e-2,
          -1.159761e-1,
          1.159761e-1,
          -1.33954e-1,
          1.33954e-1,
          -1.003048e-1,
          1.003048e-1,
          -9.747544e-2,
          9.747544e-2,
          -9.501058e-2,
          9.501058e-2,
          -1.321566e-1,
          1.321566e-1,
          -9.194706e-2,
          9.194706e-2,
          -9.359276e-2,
          9.359276e-2,
          -1.015916e-1,
          1.015916e-1,
          -1.174192e-1,
          1.174192e-1,
          -1.039931e-1,
          1.039931e-1,
          -9.746733e-2,
          9.746733e-2,
          -1.28612e-1,
          1.28612e-1,
          -1.044899e-1,
          1.044899e-1,
          -1.066385e-1,
          1.066385e-1,
          -8.368626e-2,
          8.368626e-2,
          -1.271919e-1,
          1.271919e-1,
          -1.055946e-1,
          1.055946e-1,
          -8.272876e-2,
          8.272876e-2,
          -1.370564e-1,
          1.370564e-1,
          -8.539379e-2,
          8.539379e-2,
          -1.100343e-1,
          1.100343e-1,
          -8.10217e-2,
          8.10217e-2,
          -1.028728e-1,
          1.028728e-1,
          -1.305065e-1,
          1.305065e-1,
          -1.059506e-1,
          1.059506e-1,
          -1.264646e-1,
          1.264646e-1,
          -8.383843e-2,
          8.383843e-2,
          -9.357698e-2,
          9.357698e-2,
          -7.4744e-2,
          7.4744e-2,
          -7.814045e-2,
          7.814045e-2,
          -8.60097e-2,
          8.60097e-2,
          -1.20609e-1,
          1.20609e-1,
          -9.986512e-2,
          9.986512e-2,
          -8.516476e-2,
          8.516476e-2,
          -7.198783e-2,
          7.198783e-2,
          -7.838409e-2,
          7.838409e-2,
          -1.005142e-1,
          1.005142e-1,
          -9.951857e-2,
          9.951857e-2,
          -7.253998e-2,
          7.253998e-2,
          -9.913739e-2,
          9.913739e-2,
          -7.50036e-2,
          7.50036e-2,
          -9.25809e-2,
          9.25809e-2,
          -1.400287e-1,
          1.400287e-1,
          -1.044404e-1,
          1.044404e-1,
          -7.404339e-2,
          7.404339e-2,
          -7.256833e-2,
          7.256833e-2,
          -1.006995e-1,
          1.006995e-1,
          -1.426043e-1,
          1.426043e-1,
          -1.036529e-1,
          1.036529e-1,
          -1.208443e-1,
          1.208443e-1,
          -1.074245e-1,
          1.074245e-1,
          -1.141448e-1,
          1.141448e-1,
          -1.015809e-1,
          1.015809e-1,
          -1.028822e-1,
          1.028822e-1,
          -1.055682e-1,
          1.055682e-1,
          -9.468699e-2,
          9.468699e-2,
          -1.010098e-1,
          1.010098e-1,
          -1.205054e-1,
          1.205054e-1,
          -8.392956e-2,
          8.392956e-2,
          -8.052297e-2,
          8.052297e-2,
          -9.576507e-2,
          9.576507e-2,
          -9.515692e-2,
          9.515692e-2,
          -1.564745e-1,
          1.564745e-1,
          -7.357238e-2,
          7.357238e-2,
          -1.129262e-1,
          1.129262e-1,
          -1.013265e-1,
          1.013265e-1,
          -8.760761e-2,
          8.760761e-2,
          -8.714771e-2,
          8.714771e-2,
          -9.605039e-2,
          9.605039e-2,
          -9.064677e-2,
          9.064677e-2,
          -8.243857e-2,
          8.243857e-2,
          -8.495858e-2,
          8.495858e-2,
          -8.350249e-2,
          8.350249e-2,
          -7.423234e-2,
          7.423234e-2,
          -7.930799e-2,
          7.930799e-2,
          -6.620023e-2,
          6.620023e-2,
          -7.311919e-2,
          7.311919e-2,
          -1.237938e-1,
          1.237938e-1,
          -1.086814e-1,
          1.086814e-1,
          -6.379798e-2,
          6.379798e-2,
          -7.526021e-2,
          7.526021e-2,
          -8.297097e-2,
          8.297097e-2,
          -8.186337e-2,
          8.186337e-2,
          -7.627362e-2,
          7.627362e-2,
          -1.061638e-1,
          1.061638e-1,
          -8.328494e-2,
          8.328494e-2,
          -1.040895e-1,
          1.040895e-1,
          -7.649056e-2,
          7.649056e-2,
          -7.299058e-2,
          7.299058e-2,
          -9.195198e-2,
          9.195198e-2,
          -7.99088e-2,
          7.99088e-2,
          -7.429346e-2,
          7.429346e-2,
          -9.991702e-2,
          9.991702e-2,
          -9.755385e-2,
          9.755385e-2,
          -1.344138e-1,
          1.344138e-1,
          -1.707917e-1,
          1.707917e-1,
          -8.32545e-2,
          8.32545e-2,
          -8.137793e-2,
          8.137793e-2,
          -8.308659e-2,
          8.308659e-2,
          -7.440414e-2,
          7.440414e-2,
          -7.012744e-2,
          7.012744e-2,
          -8.122943e-2,
          8.122943e-2,
          -8.845462e-2,
          8.845462e-2,
          -8.80345e-2,
          8.80345e-2,
          -9.653392e-2,
          9.653392e-2,
          -8.795691e-2,
          8.795691e-2,
          -1.119045e-1,
          1.119045e-1,
          -1.068308e-1,
          1.068308e-1,
          -8.406359e-2,
          8.406359e-2,
          -1.220414e-1,
          1.220414e-1,
          -1.024235e-1,
          1.024235e-1,
          -1.252897e-1,
          1.252897e-1,
          -1.121234e-1,
          1.121234e-1,
          -9.05415e-2,
          9.05415e-2,
          -8.974435e-2,
          8.974435e-2,
          -1.351578e-1,
          1.351578e-1,
          -1.106442e-1,
          1.106442e-1,
          -8.093913e-2,
          8.093913e-2,
          -9.800762e-2,
          9.800762e-2,
          -7.012823e-2,
          7.012823e-2,
          -7.434949e-2,
          7.434949e-2,
          -8.684816e-2,
          8.684816e-2,
          -8.916388e-2,
          8.916388e-2,
          -8.773159e-2,
          8.773159e-2,
          -7.709608e-2,
          7.709608e-2,
          -7.230518e-2,
          7.230518e-2,
          -9.662156e-2,
          9.662156e-2,
          -7.957632e-2,
          7.957632e-2,
          -7.628441e-2,
          7.628441e-2,
          -8.050202e-2,
          8.050202e-2,
          -1.290593e-1,
          1.290593e-1,
          -9.246182e-2,
          9.246182e-2,
          -9.703662e-2,
          9.703662e-2,
          -7.866445e-2,
          7.866445e-2,
          -1.064783e-1,
          1.064783e-1,
          -1.012339e-1,
          1.012339e-1,
          -6.828389e-2,
          6.828389e-2,
          -1.005039e-1,
          1.005039e-1,
          -7.559687e-2,
          7.559687e-2,
          -6.359878e-2,
          6.359878e-2,
          -8.387002e-2,
          8.387002e-2,
          -7.851323e-2,
          7.851323e-2,
          -8.878569e-2,
          8.878569e-2,
          -7.767654e-2,
          7.767654e-2,
          -8.033338e-2,
          8.033338e-2,
          -9.142797e-2,
          9.142797e-2,
          -8.590585e-2,
          8.590585e-2,
          -1.052318e-1,
          1.052318e-1,
          -8.760062e-2,
          8.760062e-2,
          -9.222192e-2,
          9.222192e-2,
          -7.548828e-2,
          7.548828e-2,
          -8.003344e-2,
          8.003344e-2,
          -1.177076e-1,
          1.177076e-1,
          -1.064964e-1,
          1.064964e-1,
          -8.655553e-2,
          8.655553e-2,
          -9.418112e-2,
          9.418112e-2,
          -7.248163e-2,
          7.248163e-2,
          -7.120974e-2,
          7.120974e-2,
          -6.393114e-2,
          6.393114e-2,
          -7.997487e-2,
          7.997487e-2,
          -1.220941e-1,
          1.220941e-1,
          -9.892518e-2,
          9.892518e-2,
          -8.270271e-2,
          8.270271e-2,
          -1.0694e-1,
          1.0694e-1,
          -5.860771e-2,
          5.860771e-2,
          -9.1266e-2,
          9.1266e-2,
          -6.212559e-2,
          6.212559e-2,
          -9.397538e-2,
          9.397538e-2,
          -8.070447e-2,
          8.070447e-2,
          -8.415587e-2,
          8.415587e-2,
          -8.564455e-2,
          8.564455e-2,
          -7.791811e-2,
          7.791811e-2,
          -6.642259e-2,
          6.642259e-2,
          -8.266167e-2,
          8.266167e-2,
          -1.134986e-1,
          1.134986e-1,
          -1.045267e-1,
          1.045267e-1,
          -7.122085e-2,
          7.122085e-2,
          -7.979415e-2,
          7.979415e-2,
          -7.922347e-2,
          7.922347e-2,
          -9.003421e-2,
          9.003421e-2,
          -8.796449e-2,
          8.796449e-2,
          -7.933279e-2,
          7.933279e-2,
          -8.307947e-2,
          8.307947e-2,
          -8.946349e-2,
          8.946349e-2,
          -7.643384e-2,
          7.643384e-2,
          -7.818534e-2,
          7.818534e-2,
          -7.990991e-2,
          7.990991e-2,
          -9.885664e-2,
          9.885664e-2,
          -8.071329e-2,
          8.071329e-2,
          -6.952112e-2,
          6.952112e-2,
          -6.429706e-2,
          6.429706e-2,
          -6.307229e-2,
          6.307229e-2,
          -8.100137e-2,
          8.100137e-2,
          -7.693623e-2,
          7.693623e-2,
          -6.906625e-2,
          6.906625e-2,
          -7.390462e-2,
          7.390462e-2,
          -6.487217e-2,
          6.487217e-2,
          -1.233681e-1,
          1.233681e-1,
          -6.979273e-2,
          6.979273e-2,
          -8.358669e-2,
          8.358669e-2,
          -1.09542e-1,
          1.09542e-1,
          -8.519717e-2,
          8.519717e-2,
          -7.599857e-2,
          7.599857e-2,
          -6.042816e-2,
          6.042816e-2,
          -6.546304e-2,
          6.546304e-2,
          -1.016245e-1,
          1.016245e-1,
          -8.308787e-2,
          8.308787e-2,
          -7.385708e-2,
          7.385708e-2,
          -6.75163e-2,
          6.75163e-2,
          -9.036695e-2,
          9.036695e-2,
          -9.371335e-2,
          9.371335e-2,
          -1.116088e-1,
          1.116088e-1,
          -5.693741e-2,
          5.693741e-2,
          -6.383983e-2,
          6.383983e-2,
          -5.389843e-2,
          5.389843e-2,
          -8.383191e-2,
          8.383191e-2,
          -7.820822e-2,
          7.820822e-2,
          -7.067557e-2,
          7.067557e-2,
          -7.971948e-2,
          7.971948e-2,
          -7.360668e-2,
          7.360668e-2,
          -7.008027e-2,
          7.008027e-2,
          -8.013378e-2,
          8.013378e-2,
          -8.331605e-2,
          8.331605e-2,
          -7.145702e-2,
          7.145702e-2,
          -7.86394e-2,
          7.86394e-2,
          -6.992679e-2,
          6.992679e-2,
          -5.716495e-2,
          5.716495e-2,
          -5.306006e-2,
          5.306006e-2,
          -8.855639e-2,
          8.855639e-2,
          -7.656397e-2,
          7.656397e-2,
          -6.939272e-2,
          6.939272e-2,
          -7.523742e-2,
          7.523742e-2,
          -8.472299e-2,
          8.472299e-2,
          -8.114341e-2,
          8.114341e-2,
          -6.795517e-2,
          6.795517e-2,
          -7.89013e-2,
          7.89013e-2,
          -7.488741e-2,
          7.488741e-2,
          -9.281972e-2,
          9.281972e-2,
          -9.325498e-2,
          9.325498e-2,
          -1.401587e-1,
          1.401587e-1,
          -1.176284e-1,
          1.176284e-1,
          -8.867597e-2,
          8.867597e-2,
          -8.124232e-2,
          8.124232e-2,
          -9.441235e-2,
          9.441235e-2,
          -8.029452e-2,
          8.029452e-2,
          -8.581848e-2,
          8.581848e-2,
          -1.029819e-1,
          1.029819e-1,
          -9.569118e-2,
          9.569118e-2,
          -7.690893e-2,
          7.690893e-2,
          -9.018228e-2,
          9.018228e-2,
          -1.049209e-1,
          1.049209e-1,
          -8.969413e-2,
          8.969413e-2,
          -8.651891e-2,
          8.651891e-2,
          -8.613331e-2,
          8.613331e-2,
          -7.120468e-2,
          7.120468e-2,
          -8.743959e-2,
          8.743959e-2,
          -7.607158e-2,
          7.607158e-2,
          -1.015547e-1,
          1.015547e-1,
          -8.090879e-2,
          8.090879e-2,
          -7.114079e-2,
          7.114079e-2,
          -8.744835e-2,
          8.744835e-2,
          -6.074904e-2,
          6.074904e-2,
          -6.919871e-2,
          6.919871e-2,
          -7.607774e-2,
          7.607774e-2,
          -9.4446e-2,
          9.4446e-2,
          -7.833429e-2,
          7.833429e-2,
          -6.817555e-2,
          6.817555e-2,
          -8.99739e-2,
          8.99739e-2,
          -9.845223e-2,
          9.845223e-2,
          -7.89418e-2,
          7.89418e-2,
          -7.921373e-2,
          7.921373e-2,
          -7.448032e-2,
          7.448032e-2,
          -1.178165e-1,
          1.178165e-1,
          -8.216686e-2,
          8.216686e-2,
          -8.103286e-2,
          8.103286e-2,
          -6.98147e-2,
          6.98147e-2,
          -8.709008e-2,
          8.709008e-2,
          -8.336259e-2,
          8.336259e-2,
          -6.213589e-2,
          6.213589e-2,
          -7.068045e-2,
          7.068045e-2,
          -6.915676e-2,
          6.915676e-2,
          -7.103416e-2,
          7.103416e-2,
          -6.523849e-2,
          6.523849e-2,
          -7.63476e-2,
          7.63476e-2,
          -7.263038e-2,
          7.263038e-2,
          -7.164396e-2,
          7.164396e-2,
          -8.745559e-2,
          8.745559e-2,
          -6.960181e-2,
          6.960181e-2,
          -8.500098e-2,
          8.500098e-2,
          -6.52326e-2,
          6.52326e-2,
          -7.319714e-2,
          7.319714e-2,
          -6.268125e-2,
          6.268125e-2,
          -7.083135e-2,
          7.083135e-2,
          -7.984517e-2,
          7.984517e-2,
          -1.256265e-1,
          1.256265e-1,
          -1.065412e-1,
          1.065412e-1,
          -8.524323e-2,
          8.524323e-2,
          -9.291364e-2,
          9.291364e-2,
          -7.936567e-2,
          7.936567e-2,
          -8.607723e-2,
          8.607723e-2,
          -7.583416e-2,
          7.583416e-2,
          -7.931928e-2,
          7.931928e-2,
          -7.408357e-2,
          7.408357e-2,
          -1.034404e-1,
          1.034404e-1,
          -1.012127e-1,
          1.012127e-1,
          -7.916689e-2,
          7.916689e-2,
          -8.753651e-2,
          8.753651e-2,
          -6.090366e-2,
          6.090366e-2,
          -7.500103e-2,
          7.500103e-2,
          -1.228709e-1,
          1.228709e-1,
          -6.318201e-2,
          6.318201e-2,
          -7.58542e-2,
          7.58542e-2,
          -7.08909e-2,
          7.08909e-2,
          -1.053542e-1,
          1.053542e-1,
          -8.549521e-2,
          8.549521e-2,
          -7.906308e-2,
          7.906308e-2,
          -6.33878e-2,
          6.33878e-2,
          -8.41791e-2,
          8.41791e-2,
          -7.115511e-2,
          7.115511e-2,
          -7.693949e-2,
          7.693949e-2,
          -7.446749e-2,
          7.446749e-2,
          -1.037929e-1,
          1.037929e-1,
          -7.991005e-2,
          7.991005e-2,
          -7.119439e-2,
          7.119439e-2,
          -7.07134e-2,
          7.07134e-2,
          -8.587362e-2,
          8.587362e-2,
          -7.001236e-2,
          7.001236e-2,
          -7.567115e-2,
          7.567115e-2,
          -7.11893e-2,
          7.11893e-2,
          -6.844895e-2,
          6.844895e-2,
          -1.035118e-1,
          1.035118e-1,
          -8.156618e-2,
          8.156618e-2,
          -7.449593e-2,
          7.449593e-2,
          -8.15436e-2,
          8.15436e-2,
          -9.110878e-2,
          9.110878e-2,
          -6.222534e-2,
          6.222534e-2,
          -1.033841e-1,
          1.033841e-1,
          -6.811687e-2,
          6.811687e-2,
          -6.828443e-2,
          6.828443e-2,
          -5.769408e-2,
          5.769408e-2,
          -5.917684e-2,
          5.917684e-2,
          -8.358868e-2,
          8.358868e-2
        ]
      }
    ]
  };

  /**
   * @author auduno / github.com/auduno
   */

  headtrackr.getWhitebalance = function (canvas) {
    // returns average gray value in canvas

    var avggray, avgr, avgb, avgg;

    var canvasContext = canvas.getContext("2d");
    var image = canvasContext.getImageData(0, 0, canvas.width, canvas.height);
    var id = image.data;
    var imagesize = image.width * image.height;
    var r = (g = b = 0);

    for (var i = 0; i < imagesize; i++) {
      r += id[4 * i];
      g += id[4 * i + 1];
      b += id[4 * i + 2];
    }

    avgr = r / imagesize;
    avgg = g / imagesize;
    avgb = b / imagesize;
    avggray = (avgr + avgg + avgb) / 3;

    return avggray;
  };
  /**
   * Smoother for smoothing tracked positions of face
   *
   * Double Exponential Smoothing-based Prediction
   *	 see: http://www.cs.brown.edu/people/jjl/pubs/kfvsexp_final_laviola.pdf
   *	 "Double Exponential Smoothing: An alternative to Kalman Filter-based Predictive Tracking"
   *
   * @author auduno / github.com/auduno
   * @param {number} a Smoothing parameter, between 0 and 1. 0 is max smoothing, 1 no smoothing.
   * @param {number} interval The ms interval between tracking events
   * @constructor
   */
  headtrackr.Smoother = function (alpha, interval) {
    // alpha = 0.35 smoothes ok while not introducing too much lag

    var sp, sp2, sl, newPositions, positions;
    var updateTime = new Date();

    this.initialized = false;

    // whether to use linear interpolation for times in intervals
    this.interpolate = false;

    this.init = function (initPos) {
      this.initialized = true;
      sp = [initPos.x, initPos.y, initPos.z, initPos.width, initPos.height];
      sp2 = sp;
      sl = sp.length;
    };

    this.smooth = function (pos) {
      positions = [pos.x, pos.y, pos.z, pos.width, pos.height];

      if (this.initialized) {
        // update
        for (var i = 0; i < sl; i++) {
          sp[i] = alpha * positions[i] + (1 - alpha) * sp[i];
          sp2[i] = alpha * sp[i] + (1 - alpha) * sp2[i];
        }

        // set time
        updateTime = new Date();

        var msDiff = new Date() - updateTime;
        var newPositions = predict(msDiff);

        pos.x = newPositions[0];
        pos.y = newPositions[1];
        pos.z = newPositions[2];
        pos.width = newPositions[3];
        pos.height = newPositions[4];

        return pos;
      } else {
        return false;
      }
    };

    function predict(time) {
      var retPos = [];

      if (this.interpolate) {
        var step = time / interval;
        var stepLo = step >> 0;
        var ratio = alpha / (1 - alpha);

        var a = (step - stepLo) * ratio;
        var b = 2 + stepLo * ratio;
        var c = 1 + stepLo * ratio;

        for (var i = 0; i < sl; i++) {
          retPos[i] = a * (sp[i] - sp2[i]) + b * sp[i] - c * sp2[i];
        }
      } else {
        var step = (time / interval) >> 0;
        var ratio = (alpha * step) / (1 - alpha);
        var a = 2 + ratio;
        var b = 1 + ratio;
        for (var i = 0; i < sl; i++) {
          retPos[i] = a * sp[i] - b * sp2[i];
        }
      }

      return retPos;
    }
  };
  /**
   * camshift object tracker
   *
   * ported with some optimizations from actionscript3 library FaceIt:
   *	 http://www.mukimuki.fr/flashblog/2009/06/18/camshift-going-to-the-source/
   *	 http://www.libspark.org/browser/as3/FaceIt
   * some explanation of algorithm here :
   *	 http://www.cognotics.com/opencv/servo_2007_series/part_3/sidebar.html
   *
   * usage:
   *	 // create a new tracker
   *	 var cstracker = new headtrackr.camshift.Tracker();
   *	 // initialize it with a canvas, and a rectangle around the object on the canvas we'd like to track
   *	 cstracker.initTracker(some_canvas, new headtrackr.camshift.Rectangle(x,y,w,h));
   *	 // find object in same or some other canvas
   *	 cstracker.track(some_canvas);
   *	 // get position of found object
   *	 var currentPos = cstracker.getTrackObj();
   *	 currentPos.x // x-coordinate of center of object on canvas
   *	 currentPos.y // y-coordinate of center of object on canvas
   *	 currentPos.width // width of object
   *	 currentPos.height // heigh of object
   *	 currentPos.angle // angle of object in radians
   *
   * @author Benjamin Jung / jungbenj@gmail.com
   * @author auduno / github.com/auduno
   *
   * License of original actionscript code:
   *
   * Copyright (C)2009 Benjamin Jung
   *
   * Licensed under the MIT License
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
   *
   */

  headtrackr.camshift = {};

  /**
   * RGB histogram
   *
   * @constructor
   */
  headtrackr.camshift.Histogram = function (imgdata) {
    this.size = 4096;

    var bins = [];
    var i, x, r, g, b, il;

    //initialize bins
    for (i = 0; i < this.size; i++) {
      bins.push(0);
    }

    //add histogram data
    for (x = 0, il = imgdata.length; x < il; x += 4) {
      r = imgdata[x + 0] >> 4; // round down to bins of 16
      g = imgdata[x + 1] >> 4;
      b = imgdata[x + 2] >> 4;
      bins[256 * r + 16 * g + b] += 1;
    }

    this.getBin = function (index) {
      return bins[index];
    };
  };

  /**
   * moments object
   *
   * @constructor
   */
  headtrackr.camshift.Moments = function (data, x, y, w, h, second) {
    this.m00 = 0;
    this.m01 = 0;
    this.m10 = 0;
    this.m11 = 0;
    this.m02 = 0;
    this.m20 = 0;

    var i, j, val, vx, vy;
    var a = [];
    for (i = x; i < w; i++) {
      a = data[i];
      vx = i - x;

      for (j = y; j < h; j++) {
        val = a[j];

        vy = j - y;
        this.m00 += val;
        this.m01 += vy * val;
        this.m10 += vx * val;
        if (second) {
          this.m11 += vx * vy * val;
          this.m02 += vy * vy * val;
          this.m20 += vx * vx * val;
        }
      }
    }

    this.invM00 = 1 / this.m00;
    this.xc = this.m10 * this.invM00;
    this.yc = this.m01 * this.invM00;
    this.mu00 = this.m00;
    this.mu01 = 0;
    this.mu10 = 0;
    if (second) {
      this.mu20 = this.m20 - this.m10 * this.xc;
      this.mu02 = this.m02 - this.m01 * this.yc;
      this.mu11 = this.m11 - this.m01 * this.xc;
    }
  };

  /**
   * rectangle object
   *
   * @constructor
   */
  headtrackr.camshift.Rectangle = function (x, y, w, h) {
    this.x = x;
    this.y = y;
    this.width = w;
    this.height = h;

    this.clone = function () {
      var c = new headtrackr.camshift.Rectangle();
      c.height = this.height;
      c.width = this.width;
      c.x = this.x;
      c.y = this.y;
      return c;
    };
  };

  /**
   * Tracker object
   *
   * @constructor
   */
  headtrackr.camshift.Tracker = function (params) {
    if (params === undefined) params = {};
    if (params.calcAngles === undefined) params.calcAngles = true;

    var _modelHist,
      _curHist, //current histogram
      _pdf, // pixel probability data for current searchwindow
      _searchWindow, // rectangle where we are searching
      _trackObj, // object holding data about where current tracked object is
      _canvasCtx, // canvas context for initial canvas
      _canvasw, // canvas width for tracking canvas
      _canvash; // canvas height for tracking canvas

    this.getSearchWindow = function () {
      // return the search window used by the camshift algorithm in the current analysed image
      return _searchWindow.clone();
    };

    this.getTrackObj = function () {
      // return a trackobj with the size and orientation of the tracked object in the current analysed image
      return _trackObj.clone();
    };

    this.getPdf = function () {
      // returns a nested array representing color
      return _pdf;
    };

    this.getBackProjectionImg = function () {
      // return imgData representing pixel color probabilities, which can then be put into canvas
      var weights = _pdf;
      var w = _canvasw;
      var h = _canvash;
      var img = _canvasCtx.createImageData(w, h);
      var imgData = img.data;
      var x, y, val;
      for (x = 0; x < w; x++) {
        for (y = 0; y < h; y++) {
          val = Math.floor(255 * weights[x][y]);
          pos = (y * w + x) * 4;
          imgData[pos] = val;
          imgData[pos + 1] = val;
          imgData[pos + 2] = val;
          imgData[pos + 3] = 255;
        }
      }
      return img;
    };

    this.initTracker = function (canvas, trackedArea) {
      // initialize the tracker with canvas and the area of interest as a rectangle

      _canvasCtx = canvas.getContext("2d");
      var taw = trackedArea.width;
      var tah = trackedArea.height;
      var tax = trackedArea.x;
      var tay = trackedArea.y;
      var trackedImg = _canvasCtx.getImageData(tax, tay, taw, tah);

      _modelHist = new headtrackr.camshift.Histogram(trackedImg.data);
      _searchWindow = trackedArea.clone();
      _trackObj = new headtrackr.camshift.TrackObj();
    };

    this.track = function (canvas) {
      // search the tracked object by camshift
      var canvasCtx = canvas.getContext("2d");
      _canvash = canvas.height;
      _canvasw = canvas.width;
      var imgData = canvasCtx.getImageData(0, 0, canvas.width, canvas.height);
      if (imgData.width != 0 && imgData.height != 0) camShift(imgData);
    };

    function camShift(frame) {
      var w = frame.width;
      var h = frame.height;

      // search location
      var m = meanShift(frame);

      var a = m.mu20 * m.invM00;
      var c = m.mu02 * m.invM00;

      if (params.calcAngles) {
        // use moments to find size and orientation
        var b = m.mu11 * m.invM00;
        var d = a + c;
        var e = Math.sqrt(4 * b * b + (a - c) * (a - c));

        // update object position
        _trackObj.width = Math.sqrt((d - e) * 0.5) << 2;
        _trackObj.height = Math.sqrt((d + e) * 0.5) << 2;
        _trackObj.angle = Math.atan2(2 * b, a - c + e);

        // to have a positive counter clockwise angle
        if (_trackObj.angle < 0) _trackObj.angle = _trackObj.angle + Math.PI;
      } else {
        _trackObj.width = Math.sqrt(a) << 2;
        _trackObj.height = Math.sqrt(c) << 2;
        _trackObj.angle = Math.PI / 2;
      }

      // check if tracked object is into the limit
      _trackObj.x = Math.floor(
        Math.max(0, Math.min(_searchWindow.x + _searchWindow.width / 2, w))
      );
      _trackObj.y = Math.floor(
        Math.max(0, Math.min(_searchWindow.y + _searchWindow.height / 2, h))
      );

      // new search window size
      _searchWindow.width = Math.floor(1.1 * _trackObj.width);
      _searchWindow.height = Math.floor(1.1 * _trackObj.height);
    }

    function meanShift(frame) {
      // mean-shift algorithm on frame

      var w = frame.width;
      var h = frame.height;
      var imgData = frame.data;

      var curHist = new headtrackr.camshift.Histogram(imgData);

      var weights = getWeights(_modelHist, curHist);

      // Color probabilities distributions
      _pdf = getBackProjectionData(imgData, frame.width, frame.height, weights);

      var m, x, y, i, wadx, wady, wadw, wadh;

      var meanShiftIterations = 10; // maximum number of iterations

      // store initial searchwindow
      var prevx = _searchWindow.x;
      var prevy = _searchWindow.y;

      // Locate by iteration the maximum of density into the probability distributions
      for (i = 0; i < meanShiftIterations; i++) {
        // get searchwindow from _pdf:
        wadx = Math.max(_searchWindow.x, 0);
        wady = Math.max(_searchWindow.y, 0);
        wadw = Math.min(wadx + _searchWindow.width, w);
        wadh = Math.min(wady + _searchWindow.height, h);

        m = new headtrackr.camshift.Moments(
          _pdf,
          wadx,
          wady,
          wadw,
          wadh,
          i == meanShiftIterations - 1
        );
        x = m.xc;
        y = m.yc;

        _searchWindow.x += (x - _searchWindow.width / 2) >> 0;
        _searchWindow.y += (y - _searchWindow.height / 2) >> 0;

        // if we have reached maximum density, get second moments and stop iterations
        if (_searchWindow.x == prevx && _searchWindow.y == prevy) {
          m = new headtrackr.camshift.Moments(
            _pdf,
            wadx,
            wady,
            wadw,
            wadh,
            true
          );
          break;
        } else {
          prevx = _searchWindow.x;
          prevy = _searchWindow.y;
        }
      }

      _searchWindow.x = Math.max(0, Math.min(_searchWindow.x, w));
      _searchWindow.y = Math.max(0, Math.min(_searchWindow.y, h));

      return m;
    }

    function getWeights(mh, ch) {
      // Return an array of the probabilities of each histogram color bins
      var weights = [];
      var p;

      // iterate over the entire histogram and compare
      for (var i = 0; i < 4096; i++) {
        if (ch.getBin(i) != 0) {
          p = Math.min(mh.getBin(i) / ch.getBin(i), 1);
        } else {
          p = 0;
        }
        weights.push(p);
      }

      return weights;
    }

    function getBackProjectionData(imgData, idw, idh, weights, hsMap) {
      // Return a matrix representing pixel color probabilities
      var data = [];
      var x, y, r, g, b, pos;
      var a = [];

      // TODO : we could use typed arrays here
      // but we should then do a compatibilitycheck

      for (x = 0; x < idw; x++) {
        a = [];
        for (y = 0; y < idh; y++) {
          pos = (y * idw + x) * 4;
          r = imgData[pos] >> 4;
          g = imgData[pos + 1] >> 4;
          b = imgData[pos + 2] >> 4;
          a.push(weights[256 * r + 16 * g + b]);
        }
        data[x] = a;
      }
      return data;
    }
  };

  /**
   * Object returned by tracker
   *  note that x,y is the point of the center of the tracker
   *
   * @constructor
   */
  headtrackr.camshift.TrackObj = function () {
    this.height = 0;
    this.width = 0;
    this.angle = 0;
    this.x = 0;
    this.y = 0;

    this.clone = function () {
      var c = new headtrackr.camshift.TrackObj();
      c.height = this.height;
      c.width = this.width;
      c.angle = this.angle;
      c.x = this.x;
      c.y = this.y;
      return c;
    };
  };
  /**
   * Library for detecting and tracking the position of a face in a canvas object
   *
   * usage:
   *	 // create a new tracker
   *	 var ft = new headtrackr.facetrackr.Tracker();
   *	 // initialize it with a canvas
   *	 ft.init(some_canvas);
   *	 // track in canvas
   *	 ft.track();
   *	 // get position of found object
   *	 var currentPos = ft.getTrackObj();
   *	 currentPos.x // x-coordinate of center of object on canvas
   *	 currentPos.y // y-coordinate of center of object on canvas
   *	 currentPos.width // width of object
   *	 currentPos.height // height of object
   *	 currentPos.angle // angle of object in radians
   *	 currentPos.confidence // returns confidence (doesn't work for CS yet)
   *	 currentPos.detection // current detectionmethod (VJ or CS)
   *	 currentPos.time // time spent
   *
   * @author auduno / github.com/auduno
   */

  headtrackr.facetrackr = {};

  /**
   * optional parameters to params:
   *	 smoothing : whether to use smoothing on output (default is true)
   *	 smoothingInterval : should be the same as detectionInterval plus time of tracking (default is 35 ms)
   *	 sendEvents : whether to send events (default is true)
   *	 whitebalancing : whether to wait for camera whitebalancing before starting detection (default is true)
   *   calcAnglss : whether to calculate orientation of tracked object (default for facetrackr is false)
   *
   * @constructor
   */
  headtrackr.facetrackr.Tracker = function (params) {
    if (!params) params = {};

    if (params.sendEvents === undefined) params.sendEvents = true;
    if (params.whitebalancing === undefined) params.whitebalancing = true;
    if (params.debug === undefined) {
      params.debug = false;
    } else {
      if (params.debug.tagName != "CANVAS") params.debug = false;
    }
    if (params.whitebalancing) {
      var _currentDetection = "WB";
    } else {
      var _currentDetection = "VJ";
    }
    if (params.calcAngles == undefined) params.calcAngles = false;

    var _inputcanvas, _curtracked, _cstracker;

    var _confidenceThreshold = -10; // needed confidence before switching to Camshift
    var previousWhitebalances = []; // array of previous 10 whitebalance values
    var pwbLength = 15;

    this.init = function (inputcanvas) {
      _inputcanvas = inputcanvas;
      // initialize cs tracker
      _cstracker = new headtrackr.camshift.Tracker({
        calcAngles: params.calcAngles
      });
    };

    this.track = function () {
      var result;
      // do detection
      if (_currentDetection == "WB") {
        result = checkWhitebalance();
      } else if (_currentDetection == "VJ") {
        result = doVJDetection();
      } else if (_currentDetection == "CS") {
        result = doCSDetection();
      }

      // check whether whitebalance is stable before starting detection
      if (result.detection == "WB") {
        if (previousWhitebalances.length >= pwbLength)
          previousWhitebalances.pop();
        previousWhitebalances.unshift(result.wb);
        if (previousWhitebalances.length == pwbLength) {
          //get max
          var max = Math.max.apply(null, previousWhitebalances);
          //get min
          var min = Math.min.apply(null, previousWhitebalances);

          // if difference between the last ten whitebalances is less than 2,
          //   we assume whitebalance is stable
          if (max - min < 2) {
            // switch to facedetection
            _currentDetection = "VJ";
          }
        }
      }
      // check if Viola-Jones has found a viable face
      if (
        result.detection == "VJ" &&
        result.confidence > _confidenceThreshold
      ) {
        // switch to Camshift
        _currentDetection = "CS";
        // when switching, we initalize camshift with current found face
        var cRectangle = new headtrackr.camshift.Rectangle(
          Math.floor(result.x),
          Math.floor(result.y),
          Math.floor(result.width),
          Math.floor(result.height)
        );
        _cstracker.initTracker(_inputcanvas, cRectangle);
      }

      _curtracked = result;

      if (result.detection == "CS" && params.sendEvents) {
        // send events
        var evt = document.createEvent("Event");
        evt.initEvent("facetrackingEvent", true, true);
        evt.height = result.height;
        evt.width = result.width;
        evt.angle = result.angle;
        evt.x = result.x;
        evt.y = result.y;
        evt.confidence = result.confidence;
        evt.detection = result.detection;
        evt.time = result.time;
        document.dispatchEvent(evt);
      }
    };

    this.getTrackingObject = function () {
      return _curtracked.clone();
    };

    // Viola-Jones detection
    function doVJDetection() {
      // start timing
      var start = new Date().getTime();

      // we seem to have to copy canvas to avoid interference with camshift
      // not entirely sure why
      // TODO: ways to avoid having to copy canvas every time
      var ccvCanvas = document.createElement("canvas");
      ccvCanvas.width = _inputcanvas.width;
      ccvCanvas.height = _inputcanvas.height;
      ccvCanvas
        .getContext("2d")
        .drawImage(_inputcanvas, 0, 0, ccvCanvas.width, ccvCanvas.height);

      var comp = headtrackr.ccv.detect_objects(
        headtrackr.ccv.grayscale(ccvCanvas),
        headtrackr.cascade,
        5,
        1
      );

      // end timing
      var diff = new Date().getTime() - start;

      // loop through found faces and pick the most likely one
      // TODO: check amount of neighbors and size as well?
      // TODO: choose the face that is most in the center of canvas?
      var candidate;
      if (comp.length > 0) {
        candidate = comp[0];
      }
      for (var i = 1; i < comp.length; i++) {
        if (comp[i].confidence > candidate.confidence) {
          candidate = comp[i];
        }
      }

      // copy information from ccv object to a new trackObj
      var result = new headtrackr.facetrackr.TrackObj();
      if (!(candidate === undefined)) {
        result.width = candidate.width;
        result.height = candidate.height;
        result.x = candidate.x;
        result.y = candidate.y;
        result.confidence = candidate.confidence;
      }

      // copy timing to object
      result.time = diff;
      result.detection = "VJ";

      return result;
    }

    // Camshift detection
    function doCSDetection() {
      // start timing
      var start = new Date().getTime();
      // detect
      _cstracker.track(_inputcanvas);
      var csresult = _cstracker.getTrackObj();

      // if debugging, draw backprojection image on debuggingcanvas
      if (params.debug) {
        params.debug
          .getContext("2d")
          .putImageData(_cstracker.getBackProjectionImg(), 0, 0);
      }

      // end timing
      var diff = new Date().getTime() - start;

      // copy information from CS object to a new trackObj
      var result = new headtrackr.facetrackr.TrackObj();
      result.width = csresult.width;
      result.height = csresult.height;
      result.x = csresult.x;
      result.y = csresult.y;
      // TODO: should we adjust this angle to be "clockwise"?
      result.angle = csresult.angle;
      // TODO: camshift should pass along some sort of confidence?
      result.confidence = 1;

      // copy timing to object
      result.time = diff;
      result.detection = "CS";

      return result;
    }

    // Whitebalancing
    function checkWhitebalance() {
      var result = new headtrackr.facetrackr.TrackObj();
      // get whitebalance value
      result.wb = headtrackr.getWhitebalance(_inputcanvas);
      result.detection = "WB";

      return result;
    }
  };

  /**
   * @constructor
   */
  headtrackr.facetrackr.TrackObj = function () {
    this.height = 0;
    this.width = 0;
    this.angle = 0;
    this.x = 0;
    this.y = 0;
    this.confidence = -10000;
    this.detection = "";
    this.time = 0;

    this.clone = function () {
      var c = new headtrackr.facetrackr.TrackObj();
      c.height = this.height;
      c.width = this.width;
      c.angle = this.angle;
      c.x = this.x;
      c.y = this.y;
      c.confidence = this.confidence;
      c.detection = this.detection;
      c.time = this.time;
      return c;
    };
  };

  /**
   * @author auduno / github.com/auduno
   * @constructor
   */

  headtrackr.Ui = function () {
    var timeout;

    // create element and attach to body
    var d = document.createElement("div"),
      d2 = document.createElement("div"),
      p = document.createElement("p");
    d.setAttribute("id", "headtrackerMessageDiv");

    d.style.left = "20%";
    d.style.right = "20%";
    d.style.top = "30%";
    d.style.fontSize = "90px";
    d.style.color = "#777";
    d.style.position = "absolute";
    d.style.fontFamily = "Helvetica, Arial, sans-serif";
    d.style.zIndex = "100002";

    d2.style.marginLeft = "auto";
    d2.style.marginRight = "auto";
    d2.style.width = "100%";
    d2.style.textAlign = "center";
    d2.style.color = "#fff";
    d2.style.backgroundColor = "#444";
    d2.style.opacity = "0.5";

    p.setAttribute("id", "headtrackerMessage");
    d2.appendChild(p);
    d.appendChild(d2);
    document.body.appendChild(d);

    var supportMessages = {
      "no getUserMedia": "getUserMedia is not supported in your browser :(",
      "no camera": "no camera found :("
    };

    var statusMessages = {
      whitebalance: "Waiting for camera whitebalancing",
      detecting: "Please wait while camera is detecting your face...",
      hints:
        "We seem to have some problems detecting your face. Please make sure that your face is well and evenly lighted, and that your camera is working.",
      redetecting: "Lost track of face, trying to detect again..",
      lost: "Lost track of face :(",
      found: "Face found! Move your head!"
    };

    var override = false;

    // function to call messages (and to fade them out after a time)
    document.addEventListener(
      "headtrackrStatus",
      function (event) {
        if (event.status in statusMessages) {
          window.clearTimeout(timeout);
          if (!override) {
            var messagep = document.getElementById("headtrackerMessage");
            messagep.innerHTML = statusMessages[event.status];
            timeout = window.setTimeout(function () {
              messagep.innerHTML = "";
            }, 3000);
          }
        } else if (event.status in supportMessages) {
          override = true;
          window.clearTimeout(timeout);
          var messagep = document.getElementById("headtrackerMessage");
          messagep.innerHTML = supportMessages[event.status];
          window.setTimeout(function () {
            messagep.innerHTML = "added fallback video for demo";
          }, 2000);
          window.setTimeout(function () {
            messagep.innerHTML = "";
            override = false;
          }, 4000);
        }
      },
      true
    );
  };
  /**
   * Calculates an estimate of the position of the head of the user in relation to screen or camera
   *   based on input from facetrackrObject
   *
   * Usage:
   *	var hp = new headtrackr.headposition.Tracker(facetrackrObject, 640, 480);
   *	var currentPosition = hp.track(facetrackrObject);
   *
   * @author auduno / github.com/auduno
   */

  headtrackr.headposition = {};

  /**
   *
   * Parameters to Tracker() are:
   *	facetrackrObject : a generic object with attributes x, y, width, height, angle
   *		which describe the position of center of detected face
   *	camwidth : width of canvas where the face was detected
   *	camheight : height of canvas where the face was detected
   *
   * Optional parameters can be passed along like this:
   *	 headtrackr.headposition.Tracker(facetrackrObject, 640, 480, {fov : 60})
   *
   * Optional parameters:
   *	 fov {number} : horizontal field of view of camera (default is to detect via distance to screen, any fov overrides distance_to_screen)
   *	 distance_to_screen {number} : initial distance from face to camera, in cms (default is 60 cm)
   *	 edgecorrection {boolean} : whether to use heuristic for position of head when detection is on the edge of the screen (default is true)
   *	 distance_from_camera_to_screen : distance from camera to center of screen (default is 11.5 cm, typical for laptops)
   *
   * Returns a generic object with attributes x, y, z which is estimated headposition in cm in relation to center of screen
   *
   * @constructor
   */
  headtrackr.headposition.Tracker = function (
    facetrackrObj,
    camwidth,
    camheight,
    params
  ) {
    // some assumptions that are used when calculating distances and estimating horizontal fov
    //	 head width = 16 cm
    //	 head height = 19 cm
    //	 when initialized, user is approximately 60 cm from camera

    if (!params) params = {};

    if (params.edgecorrection === undefined) {
      var edgecorrection = true;
    } else {
      var edgecorrection = params.edgecorrection;
    }

    this.camheight_cam = camheight;
    this.camwidth_cam = camwidth;

    var head_width_cm = 16;
    var head_height_cm = 19;

    // angle between side of face and diagonal across
    var head_small_angle = Math.atan(head_width_cm / head_height_cm);

    var head_diag_cm = Math.sqrt(
      head_width_cm * head_width_cm + head_height_cm * head_height_cm
    ); // diagonal of face in real space

    var sin_hsa = Math.sin(head_small_angle); //precalculated sine
    var cos_hsa = Math.cos(head_small_angle); //precalculated cosine
    var tan_hsa = Math.tan(head_small_angle); //precalculated tan

    // estimate horizontal field of view of camera
    var init_width_cam = facetrackrObj.width;
    var init_height_cam = facetrackrObj.height;
    var head_diag_cam = Math.sqrt(
      init_width_cam * init_width_cam + init_height_cam * init_height_cam
    );
    if (params.fov === undefined) {
      // we use the diagonal of the faceobject to estimate field of view of the camera
      // we use the diagonal since this is less sensitive to errors in width or height
      var head_width_cam = sin_hsa * head_diag_cam;
      var camwidth_at_default_face_cm =
        (this.camwidth_cam / head_width_cam) * head_width_cm;
      // we assume user is sitting around 60 cm from camera (normal distance on a laptop)
      if (params.distance_to_screen === undefined) {
        var distance_to_screen = 60;
      } else {
        var distance_to_screen = params.distance_to_screen;
      }
      // calculate estimate of field of view
      var fov_width =
        Math.atan(camwidth_at_default_face_cm / 2 / distance_to_screen) * 2;
    } else {
      var fov_width = (params.fov * Math.PI) / 180;
    }

    // precalculate ratio between camwidth and distance
    var tan_fov_width = 2 * Math.tan(fov_width / 2);

    var x, y, z; // holds current position of head (in cms from center of screen)

    this.track = function (facetrackrObj) {
      var w = facetrackrObj.width;
      var h = facetrackrObj.height;
      var fx = facetrackrObj.x;
      var fy = facetrackrObj.y;

      if (edgecorrection) {
        // recalculate head_diag_cam, fx, fy

        var margin = 11;

        var leftDistance = fx - w / 2;
        var rightDistance = this.camwidth_cam - (fx + w / 2);
        var topDistance = fy - h / 2;
        var bottomDistance = this.camheight_cam - (fy + h / 2);

        var onVerticalEdge = leftDistance < margin || rightDistance < margin;
        var onHorizontalEdge = topDistance < margin || bottomDistance < margin;

        if (onHorizontalEdge) {
          if (onVerticalEdge) {
            // we are in a corner, use previous diagonal as estimate, i.e. don't change head_diag_cam
            var onLeftEdge = leftDistance < margin;
            var onTopEdge = topDistance < margin;

            if (onLeftEdge) {
              fx = w - (head_diag_cam * sin_hsa) / 2;
            } else {
              fx = fx - w / 2 + (head_diag_cam * sin_hsa) / 2;
            }

            if (onTopEdge) {
              fy = h - (head_diag_cam * cos_hsa) / 2;
            } else {
              fy = fy - h / 2 + (head_diag_cam * cos_hsa) / 2;
            }
          } else {
            // we are on top or bottom edge of camera, use width instead of diagonal and correct y-position
            // fix fy
            if (topDistance < margin) {
              var originalWeight = topDistance / margin;
              var estimateWeight = (margin - topDistance) / margin;
              fy =
                h -
                (originalWeight * (h / 2) + estimateWeight * (w / tan_hsa / 2));
              head_diag_cam =
                estimateWeight * (w / sin_hsa) +
                originalWeight * Math.sqrt(w * w + h * h);
            } else {
              var originalWeight = bottomDistance / margin;
              var estimateWeight = (margin - bottomDistance) / margin;
              fy =
                fy -
                h / 2 +
                (originalWeight * (h / 2) + estimateWeight * (w / tan_hsa / 2));
              head_diag_cam =
                estimateWeight * (w / sin_hsa) +
                originalWeight * Math.sqrt(w * w + h * h);
            }
          }
        } else if (onVerticalEdge) {
          // we are on side edges of camera, use height and correct x-position
          if (leftDistance < margin) {
            var originalWeight = leftDistance / margin;
            var estimateWeight = (margin - leftDistance) / margin;
            head_diag_cam =
              estimateWeight * (h / cos_hsa) +
              originalWeight * Math.sqrt(w * w + h * h);
            fx =
              w -
              (originalWeight * (w / 2) + estimateWeight * ((h * tan_hsa) / 2));
          } else {
            var originalWeight = rightDistance / margin;
            var estimateWeight = (margin - rightDistance) / margin;
            head_diag_cam =
              estimateWeight * (h / cos_hsa) +
              originalWeight * Math.sqrt(w * w + h * h);
            fx =
              fx -
              w / 2 +
              (originalWeight * (w / 2) + estimateWeight * ((h * tan_hsa) / 2));
          }
        } else {
          head_diag_cam = Math.sqrt(w * w + h * h);
        }
      } else {
        head_diag_cam = Math.sqrt(w * w + h * h);
      }

      // calculate cm-distance from screen
      z = (head_diag_cm * this.camwidth_cam) / (tan_fov_width * head_diag_cam);
      // to transform to z_3ds : z_3ds = (head_diag_3ds/head_diag_cm)*z
      // i.e. just use ratio

      // calculate cm-position relative to center of screen
      x = -(fx / this.camwidth_cam - 0.5) * z * tan_fov_width;
      y =
        -(fy / this.camheight_cam - 0.5) *
        z *
        tan_fov_width *
        (this.camheight_cam / this.camwidth_cam);

      // Transformation from position relative to camera, to position relative to center of screen
      if (params.distance_from_camera_to_screen === undefined) {
        // default is 11.5 cm approximately
        y = y + 11.5;
      } else {
        y = y + params.distance_from_camera_to_screen;
      }

      // send off event
      var evt = document.createEvent("Event");
      evt.initEvent("headtrackingEvent", true, true);
      evt.x = x;
      evt.y = y;
      evt.z = z;
      document.dispatchEvent(evt);

      return new headtrackr.headposition.TrackObj(x, y, z);
    };

    this.getTrackerObj = function () {
      return new headtrackr.headposition.TrackObj(x, y, z);
    };

    this.getFOV = function () {
      return (fov_width * 180) / Math.PI;
    };
  };

  /**
   * @constructor
   */
  headtrackr.headposition.TrackObj = function (x, y, z) {
    this.x = x;
    this.y = y;
    this.z = z;

    this.clone = function () {
      var c = new headtrackr.headposition.TrackObj();
      c.x = this.x;
      c.y = this.y;
      c.z = this.z;
      return c;
    };
  };
  /**
   * Optional controllers for handling headtrackr events
   *
   * @author auduno / github.com/auduno
   */

  headtrackr.controllers = {};

  // NB! made for three.js revision 48. May not work with other revisions.

  headtrackr.controllers.three = {};

  /**
   * Controls a THREE.js camera to create pseudo-3D effect
   *
   * Needs the position of "screen" in 3d-model to be given up front, and to be static (i.e. absolute) during headtracking
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} scaling The scaling of the "screen" in the 3d model.
   *   This is the vertical size of screen in 3d-model relative to vertical size of computerscreen in real life
   * @param {array} fixedPosition array with attributes x,y,z, position of "screen" in 3d-model
   * @param {THREE.Vector3} lookAt the object/position the camera should be pointed towards
   * @param {object} params optional object with optional parameters
   *
   * Optional parameters:
   *   screenHeight : vertical size of computer screen (default is 20 cm, i.e. typical laptop size)
   */
  headtrackr.controllers.three.realisticAbsoluteCameraControl = function (
    camera,
    scaling,
    fixedPosition,
    lookAt,
    params
  ) {
    if (params === undefined) params = {};
    if (params.screenHeight === undefined) {
      var screenHeight_cms = 20;
    } else {
      var screenHeight_cms = params.screenHeight;
    }
    if (params.damping === undefined) {
      params.damping = 1;
    }

    camera.position.x = fixedPosition[0];
    camera.position.y = fixedPosition[1];
    camera.position.z = fixedPosition[2];
    camera.lookAt(lookAt);

    var wh = screenHeight_cms * scaling;
    var ww = wh * camera.aspect;

    document.addEventListener(
      "headtrackingEvent",
      function (event) {
        // update camera
        var xOffset = event.x > 0 ? 0 : -event.x * 2 * params.damping * scaling;
        var yOffset = event.y < 0 ? 0 : event.y * 2 * params.damping * scaling;
        camera.setViewOffset(
          ww + Math.abs(event.x * 2 * params.damping * scaling),
          wh + Math.abs(event.y * params.damping * 2 * scaling),
          xOffset,
          yOffset,
          ww,
          wh
        );

        camera.position.x =
          fixedPosition[0] + event.x * scaling * params.damping;
        camera.position.y =
          fixedPosition[1] + event.y * scaling * params.damping;
        camera.position.z = fixedPosition[2] + event.z * scaling;

        // update lookAt?

        // when changing height of window, we need to change field of view
        camera.fov =
          (Math.atan(
            (wh / 2 + Math.abs(event.y * scaling * params.damping)) /
              Math.abs(event.z * scaling)
          ) *
            360) /
          Math.PI;
        //debugger;

        camera.updateProjectionMatrix();
      },
      false
    );
  };

  /**
   * Controls a THREE.js camera to create pseudo-3D effect
   *
   * Places "screen" in 3d-model in relation to original cameraposition at any given time
   * Currently not sure if this works properly, or at all
   *
   * @param {THREE.PerspectiveCamera} camera
   * @param {number} scaling The scaling of the "screen" in the 3d model.
   *   This is the vertical size of screen in 3d-model relative to vertical size of computerscreen in real life
   * @param {array} relativeFixedDistance how long in front of (or behind) original cameraposition the fixed frame will be
   * @param {object} params optional object with optional parameters
   *
   * Optional parameters:
   *   screenHeight : vertical size of computer screen (default is 20 cm, i.e. typical laptop size)
   */
  headtrackr.controllers.three.realisticRelativeCameraControl = function (
    camera,
    scaling,
    relativeFixedDistance,
    params
  ) {
    // we assume that the parent of camera is the scene

    if (params === undefined) params = {};
    if (params.screenHeight === undefined) {
      var screenHeight_cms = 20;
    } else {
      var screenHeight_cms = params.screenHeight;
    }

    var scene = camera.parent;

    var init = true;

    // create an object to offset camera without affecting existing camera interaction
    var offset = new THREE.Object3D();
    offset.position.set(0, 0, 0);
    offset.add(camera);
    scene.add(offset);

    // TODO : we maybe need to offset functions like lookAt as well
    //	use prototype function replacement for this?

    var wh = screenHeight_cms * scaling;
    var ww = wh * camera.aspect;

    // set fov
    document.addEventListener(
      "headtrackingEvent",
      function (event) {
        // update camera
        var xOffset = event.x > 0 ? 0 : -event.x * 2 * scaling;
        var yOffset = event.y > 0 ? 0 : -event.y * 2 * scaling;
        camera.setViewOffset(
          ww + Math.abs(event.x * 2 * scaling),
          wh + Math.abs(event.y * 2 * scaling),
          xOffset,
          yOffset,
          ww,
          wh
        );

        offset.rotation = camera.rotation;
        offset.position.x = 0;
        offset.position.y = 0;
        offset.position.z = 0;
        offset.translateX(event.x * scaling);
        offset.translateY(event.y * scaling);
        offset.translateZ(event.z * scaling + relativeFixedDistance);

        //offset.position.x = (event.x * scaling);
        //offset.position.y = (event.y * scaling);
        //offset.position.z = (event.z * scaling)+relativeFixedDistance;

        // when changing height of window, we need to change field of view
        camera.fov =
          (Math.atan(
            (wh / 2 + Math.abs(event.y * scaling)) / Math.abs(event.z * scaling)
          ) *
            360) /
          Math.PI;

        camera.updateProjectionMatrix();
      },
      false
    );
  };

  return headtrackr;
});
