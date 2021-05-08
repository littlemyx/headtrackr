/* eslint-disable no-bitwise */
import getWhitebalance from "./FaceTracker/whitebalance";
import Ui from "./ui";
import Smoother from "./Smoother";
import FaceTracker from "./FaceTracker";
import Headposition from "./Headposition";
import TrackObject from "./TrackObject";
import { DetectionTypesEnum } from "./DetectionTypes";

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

// const rev = 2;

// video support utility functions

function supportsVideo() {
  return !!document.createElement("video").canPlayType;
}

function supportsh264BaselineVideo() {
  if (!supportsVideo()) {
    return false;
  }
  const v = document.createElement("video");
  return v.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
}

function supportsOggTheoraVideo() {
  if (!supportsVideo()) {
    return false;
  }
  const v = document.createElement("video");
  return v.canPlayType('video/ogg; codecs="theora, vorbis"');
}

function supportsWebmVideo() {
  if (!supportsVideo()) {
    return false;
  }
  const v = document.createElement("video");
  return v.canPlayType('video/webm; codecs="vp8, vorbis"');
}

type AltVideo = {
  ogv: string;
  mp4: string;
  webm?: string;
};

type Params = {
  smoothing?: boolean;
  retryDetection?: boolean;
  ui?: boolean;
  detectionInterval?: number;
  debug?: boolean;
  debugCanvas?: HTMLCanvasElement; // TODO make sure that it exists
  fadeVideo?: boolean;
  cameraOffset?: number;
  calcAngles?: boolean;
  headPosition?: boolean;
  altVideo?: AltVideo;
  fov?: number;
};

type VideoParams = {
  video: HTMLVideoElement;
  canvas: HTMLCanvasElement;
  setupVideo?: boolean;
};

/**
 * @constructor
 */
export default class Tracker {
  private smoother: Smoother;

  private facetracker: FaceTracker | undefined;

  private headposition: Headposition | null | undefined;

  private canvasContext: CanvasRenderingContext2D;

  private videoElement: HTMLVideoElement;

  private canvasElement: HTMLCanvasElement;

  private detector: number | undefined;

  private detectionTimer: number = 0;

  private fov = 0;

  private initialized = true;

  private run = false;

  private faceFound = false;

  private firstRun = true;

  private videoFaded = false;

  private headDiagonal: number[] = [];

  private status: string = "";

  private stream: MediaStream | undefined;

  private isReady: boolean = false;

  public debugContext: CanvasRenderingContext2D | undefined;

  public params: Params;

  constructor(
    params: Params = {},
    { video, canvas, setupVideo = true }: VideoParams
  ) {
    this.params = {
      smoothing: true,
      retryDetection: true,
      ui: true,
      detectionInterval: 20,
      debug: false,
      fadeVideo: false,
      cameraOffset: 11.5,
      calcAngles: false,
      headPosition: true,
      ...params,
    };

    if (this.params.debug) {
      this.debugContext = params.debugCanvas!.getContext("2d")!;
    }

    if (setupVideo === true) {
      window.URL = window.URL || window.webkitURL;
      // check for camerasupport

      if (navigator.mediaDevices.getUserMedia) {
        this.headtrackerStatus("getUserMedia");

        const videoSelector: MediaStreamConstraints = {
          video: true,
        };

        // set up stream
        navigator.mediaDevices
          .getUserMedia(videoSelector)
          .then((stream: MediaStream) => {
            this.headtrackerStatus("camera found");

            const button = document.getElementById("startPaly")!;
            button.addEventListener("click", () => {
              video
                .play()
                .then((...args) => {
                  console.log(args);
                })
                .catch((error) => {
                  console.log(error);
                });
            });

            this.stream = stream;

            // video.setAttribute(
            //   "src",
            //   window.URL.createObjectURL(stream)
            // );
            const mediaStream = new MediaStream(stream);

            // eslint-disable-next-line no-param-reassign
            video.srcObject = mediaStream;

            video.play();
          })
          .catch(() => {
            this.headtrackerStatus("no camera");
            this.insertAltVideo(video);
          });

        this.isReady = true;
      } else {
        this.headtrackerStatus("no getUserMedia");
        if (this.insertAltVideo(video)) {
          this.isReady = true;
        }
      }

      // resize video when it is playing
      video.addEventListener(
        "playing",
        () => {
          if (video.width > video.height) {
            video.setAttribute("width", "320");
          } else {
            video.setAttribute("height", "240");
          }
        },
        false
      );
    }

    this.videoElement = video;
    this.canvasElement = canvas;
    this.canvasContext = canvas.getContext("2d")!;

    // create ui if needed
    if (params.ui) {
      Ui();
    }

    // create smoother if enabled
    this.smoother = new Smoother(
      0.35,
      this.params.detectionInterval! + 15
    );

    this.initialized = true;
  }

  headtrackerStatus = (message: string) => {
    const statusEvent = new CustomEvent("Event", {
      detail: { status: message },
    });
    statusEvent.initEvent("headtrackrStatus", true, true);
    document.dispatchEvent(statusEvent);
    this.status = message;
  };

  insertAltVideo = (video: HTMLVideoElement): boolean => {
    if (this.params.altVideo !== undefined && supportsVideo()) {
      if (this.params.altVideo.ogv && supportsOggTheoraVideo()) {
        video.setAttribute("src", this.params.altVideo.ogv);
      } else if (
        this.params.altVideo.mp4 &&
        supportsh264BaselineVideo()
      ) {
        video.setAttribute("src", this.params.altVideo.mp4);
      } else if (this.params.altVideo.webm && supportsWebmVideo()) {
        video.setAttribute("src", this.params.altVideo.webm);
      } else {
        return false;
      }
      video.play();
      return true;
    }
    return false;
  };

  track = () => {
    // Copy video to canvas
    this.canvasContext.drawImage(
      this.videoElement,
      0,
      0,
      this.canvasElement.width,
      this.canvasElement.height
    );

    // if facetracking hasn't started, initialize facetrackr
    if (this.facetracker === undefined) {
      this.facetracker = new FaceTracker(this.canvasElement, {
        debug: this.params.debug,
        calcAngles: this.params.calcAngles,
      });
    }

    // track face
    this.facetracker.track();
    let faceObj = this.facetracker.getTrackingObject();

    if (faceObj.detection === DetectionTypesEnum.WB) {
      this.headtrackerStatus("whitebalance");
    }
    if (
      this.firstRun &&
      faceObj.detection === DetectionTypesEnum.VJ
    ) {
      this.headtrackerStatus("detecting");
    }

    // check if we have a detection first
    if (!(faceObj.confidence === 0)) {
      if (faceObj.detection === DetectionTypesEnum.VJ) {
        if (this.detectionTimer === 0) {
          // start timing
          this.detectionTimer = new Date().getTime();
        }
        if (new Date().getTime() - this.detectionTimer > 5000) {
          this.headtrackerStatus("hints");
        }

        // const x = faceObj.x + faceObj.width / 2; // midpoint
        // const y = faceObj.y + faceObj.height / 2; // midpoint

        if (this.params.debug) {
          // draw detected face on debuggercanvas
          this.debugContext!.strokeStyle = "#0000CC";
          this.debugContext!.strokeRect(
            faceObj.x,
            faceObj.y,
            faceObj.width,
            faceObj.height
          );
        }
      }
      if (faceObj.detection === DetectionTypesEnum.CS) {
        // const { x } = faceObj; // midpoint
        // const { y } = faceObj; // midpoint

        if (this.detectionTimer !== 0) {
          this.detectionTimer = 0;
        }

        if (this.params.debug) {
          // draw tracked face on debuggercanvas
          this.debugContext!.translate(faceObj.x, faceObj.y);
          this.debugContext!.rotate(faceObj.angle - Math.PI / 2);
          this.debugContext!.strokeStyle = "#00CC00";
          this.debugContext!.strokeRect(
            -(faceObj.width / 2) >> 0,
            -(faceObj.height / 2) >> 0,
            faceObj.width,
            faceObj.height
          );
          this.debugContext!.rotate(Math.PI / 2 - faceObj.angle);
          this.debugContext!.translate(-faceObj.x, -faceObj.y);
        }

        // fade out video if it's showing
        if (!this.videoFaded && this.params.fadeVideo) {
          this.fadeVideo();
          this.videoFaded = true;
        }

        this.status = "tracking";

        // check if we've lost tracking of face
        if (faceObj.width === 0 || faceObj.height === 0) {
          if (this.params.retryDetection) {
            // retry facedetection
            this.headtrackerStatus("redetecting");

            this.facetracker = new FaceTracker(this.canvasElement, {
              whitebalancing: false,
              debug: this.params.debug,
              calcAngles: this.params.calcAngles,
            });

            this.faceFound = false;
            this.headposition = null;

            // show video again if it's not already showing
            if (this.videoFaded) {
              this.videoElement.style.opacity = "1";
              this.videoFaded = false;
            }
          } else {
            this.headtrackerStatus("lost");
            this.stop();
          }
        } else {
          if (!this.faceFound) {
            this.headtrackerStatus("found");
            this.faceFound = true;
          }

          if (this.params.smoothing) {
            // smooth values
            if (!this.smoother.initialized) {
              this.smoother.init({ z: 0, ...faceObj });
            }
            const smoothed = this.smoother.smooth({
              z: 0,
              ...faceObj,
            });
            faceObj = new TrackObject({ ...smoothed });
          }

          // get headposition
          if (
            this.headposition === undefined &&
            this.params.headPosition
          ) {
            // wait until headdiagonal is stable before initializing headposition
            let stable = false;

            // calculate headdiagonal
            const headdiag = Math.sqrt(
              faceObj.width * faceObj.width +
                faceObj.height * faceObj.height
            );

            if (this.headDiagonal.length < 6) {
              this.headDiagonal.push(headdiag);
            } else {
              this.headDiagonal.splice(0, 1);
              this.headDiagonal.push(headdiag);
              if (
                Math.max.apply(null, this.headDiagonal) -
                  Math.min.apply(null, this.headDiagonal) <
                5
              ) {
                stable = true;
              }
            }

            if (stable) {
              if (this.firstRun) {
                if (this.params.fov === undefined) {
                  this.headposition = new Headposition(
                    faceObj,
                    this.canvasElement.width,
                    this.canvasElement.height,
                    {
                      distanceFromCameraToScreen: this.params
                        .cameraOffset,
                    }
                  );
                } else {
                  this.headposition = new Headposition(
                    faceObj,
                    this.canvasElement.width,
                    this.canvasElement.height,
                    {
                      fov: this.params.fov,
                      distanceFromCameraToScreen: this.params
                        .cameraOffset,
                    }
                  );
                }
                this.fov = this.headposition.getFOV();
                this.firstRun = false;
              } else {
                this.headposition = new Headposition(
                  faceObj,
                  this.canvasElement.width,
                  this.canvasElement.height,
                  {
                    fov: this.fov,
                    distanceFromCameraToScreen: this.params
                      .cameraOffset,
                  }
                );
              }
              this.headposition.track(faceObj);
            }
          } else if (this.headposition && this.params.headPosition) {
            this.headposition.track(faceObj);
          }
        }
      }
    }

    if (this.run) {
      this.detector = requestAnimationFrame(this.track);
      /* detector = window.setTimeout(track, params.detectionInterval); */
    }
  };

  starter = () => {
    // does some safety checks before starting

    // sometimes canvasContext is not available yet, so try and catch if it's not there...
    try {
      this.canvasContext.drawImage(
        this.videoElement,
        0,
        0,
        this.canvasElement.width,
        this.canvasElement.height
      );

      // in some cases, the video sends events before starting to draw
      // so check that we have something on video before starting to track
      const canvasContent = getWhitebalance(this.canvasElement);

      if (canvasContent > 0) {
        this.run = true;
        this.track();
      } else {
        window.setTimeout(this.starter, 100);
      }
    } catch (err) {
      window.setTimeout(this.starter, 100);
    }
  };

  start = () => {
    // check if initialized
    if (!this.initialized) return false;

    // check if video is playing, if not, return false
    if (
      !(
        this.videoElement.currentTime > 0 &&
        !this.videoElement.paused &&
        !this.videoElement.ended
      )
    ) {
      this.run = true;
      // set event
      this.videoElement.addEventListener(
        "playing",
        this.starter,
        false
      );

      return true;
    }
    this.starter();

    return true;
  };

  stop = () => {
    window.clearTimeout(this.detector);
    this.run = false;
    this.headtrackerStatus("stopped");
    // this.facetracker = undefined;
    this.faceFound = false;

    return true;
  };

  stopStream = () => {
    if (this.stream !== undefined) {
      this.stream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  };

  getFOV = () => {
    return this.fov;
  };

  // fade out videoElement
  fadeVideo = () => {
    if (this.videoElement.style.opacity === "") {
      this.videoElement.style.opacity = "0.98";
      window.setTimeout(this.fadeVideo, 50);
    } else if (parseInt(this.videoElement.style.opacity, 10) > 0.3) {
      this.videoElement.style.opacity = `${
        parseInt(this.videoElement.style.opacity, 10) - 0.02
      }`;
      window.setTimeout(this.fadeVideo, 50);
    } else {
      this.videoElement.style.opacity = "0.3";
    }
  };
}
