import { RotationData } from "../types";

let params = new URLSearchParams(window.location.search);

export const refetchParams = () => {
  params = new URLSearchParams(window.location.search);
}

export const initIdFromParams = () => {
  refetchParams();
  if (params.has("id")) {
    return params.get("id") ?? "-1";
  }
  console.log("initIdFromParams: No id found, returning -1");
  return "-1";
};

export const initFromParams = () => {
  refetchParams();
  if (params.has("yaw") || params.has("pitch")) {
    return {
      yaw: Number(params.get("yaw") ?? 0),
      pitch: Number(params.get("pitch") ?? 0),
    };
  }
  return { yaw: 0, pitch: 0 };
};

export const setOnPopstateEvent = (setCurrentId, camRotation) => {
  window.onpopstate = () => {
    refetchParams();
    if (params.has("id")) {
      setCurrentId(params.get("id") ?? "0");
    }

    if (params.has("yaw") || params.has("pitch")) {
      camRotation.current = {
        yaw: Number(params.get("yaw") ?? camRotation.current["yaw"] ?? 0),
        pitch: Number(params.get("pitch") ?? camRotation.current["pitch"] ?? 0),
      };
    }
  };
};

export const updateParams = (camRotation: React.MutableRefObject<RotationData>) => {
  refetchParams();
  params.set("yaw", Number(camRotation.current["yaw"]).toFixed(4));
  params.set("pitch", Number(camRotation.current["pitch"]).toFixed(4));
  history.replaceState({}, "", "?" + params.toString());
};

export function updateHistory(locationGroup, PROJECT_NAME, currentId) {
  refetchParams();
  params.set("id", currentId);

  const newTitle = locationGroup
    ? `${PROJECT_NAME} - ${locationGroup}`
    : PROJECT_NAME;
  if (document.title !== newTitle) {
    document.title = newTitle;
  }

  history.pushState({}, "", "?" + params.toString());
}

export function nullIdValue(currentId) {
  // Only consider it null if the ID is -1 or if there's no ID parameter
  return Number(currentId) === -1 || !params.has("id");
}
