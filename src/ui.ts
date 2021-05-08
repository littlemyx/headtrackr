/**
 * @author auduno / github.com/auduno
 * @constructor
 */

function isCustomEvent(event: Event): event is CustomEvent {
  return "detail" in event;
}

export default () => {
  let timeout: number;

  // create element and attach to body
  const d = document.createElement("div");
  const d2 = document.createElement("div");
  const p = document.createElement("p");

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

  let override = false;

  // function to call messages (and to fade them out after a time)
  document.addEventListener(
    "headtrackrStatus",
    (event: Event) => {
      if (!isCustomEvent(event)) {
        throw new Error("not a custom event");
      }
      const {
        detail: { status },
      } = event;
      const messagep = document.getElementById("headtrackerMessage")!;
      if (status in StatusMessages) {
        window.clearTimeout(timeout);

        if (!override) {
          // messagep.innerHTML = StatusMessages[event.status];
          timeout = window.setTimeout(function () {
            messagep.innerHTML = "";
          }, 3000);
        }
      } else if (status in SupportMessages) {
        override = true;
        window.clearTimeout(timeout);

        // messagep.innerHTML = SupportMessages[event.status];
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
