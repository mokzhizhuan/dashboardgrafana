import { useMemo, useState } from "react";
import type {
  FeedbackState,
  FeedbackTone,
  HeartbeatRow,
  SimulatorStatus,
  StreamMode,
} from "./AdminTypes";
import {
  buildDeviceCounts,
  buildDeviceIntelligenceRows,
  buildHeartbeatRows,
  buildTopRiskNames,
  buildVisibleDeviceRows,
} from "./adminSimulatorHelpers";

export function useDeviceIntelligenceController(params: {
  status: SimulatorStatus | null;
  streamConnected: boolean;
  streamMode: StreamMode;
  feedback: FeedbackState | null;
  setFeedback: (type: FeedbackTone, message: string) => void;
}) {
  const { status, streamConnected, streamMode, feedback, setFeedback } = params;

  const [deviceFilter, setDeviceFilter] = useState<
    "all" | "online" | "stale" | "offline" | "fault"
  >("all");
  const [deviceSort, setDeviceSort] = useState<
    "priority_desc" | "name_asc" | "delay_desc" | "status"
  >("priority_desc");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceIntelCollapsed, setDeviceIntelCollapsed] = useState(false);
  const [showTopRiskOnly, setShowTopRiskOnly] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("");
  const [copiedDevice, setCopiedDevice] = useState("");
  const [lastTargetedDevice, setLastTargetedDevice] = useState("");

  const staleThresholdSec = useMemo(
    () => Math.max(15, (status?.interval ?? 5) * 3),
    [status?.interval],
  );

  const deviceIntelligenceRows = useMemo(
    () => buildDeviceIntelligenceRows(status, staleThresholdSec, streamMode),
    [status, staleThresholdSec, streamMode],
  );

  const visibleDeviceRows = useMemo(
    () =>
      buildVisibleDeviceRows(
        deviceIntelligenceRows,
        deviceFilter,
        deviceSort,
        deviceSearch,
        showTopRiskOnly,
      ),
    [
      deviceIntelligenceRows,
      deviceFilter,
      deviceSort,
      deviceSearch,
      showTopRiskOnly,
    ],
  );

  const deviceCounts = useMemo(
    () => buildDeviceCounts(deviceIntelligenceRows),
    [deviceIntelligenceRows],
  );

  const topRiskNames = useMemo(
    () => buildTopRiskNames(visibleDeviceRows),
    [visibleDeviceRows],
  );

  const heartbeatRows: HeartbeatRow[] = useMemo(
    () => buildHeartbeatRows(visibleDeviceRows, status),
    [visibleDeviceRows, status],
  );

  const copyDeviceName = async (deviceName: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(deviceName);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = deviceName;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }

      setCopiedDevice(deviceName);
      setTimeout(() => setCopiedDevice(""), 1500);
      setFeedback("success", `Copied device: ${deviceName}`);
    } catch (err) {
      console.error(err);
      setFeedback("error", "Failed to copy device name");
    }
  };

  const isolateDevice = (deviceName: string) => {
    setSelectedDevice(deviceName);
    setDeviceSearch(deviceName);
    setDeviceFilter("all");
    setShowTopRiskOnly(false);
    setFeedback("info", `Showing only ${deviceName}`);
  };

  const clearDeviceFocus = () => {
    setSelectedDevice("");
    setDeviceSearch("");
    setDeviceFilter("all");
    setShowTopRiskOnly(false);
    setFeedback("info", "Cleared device focus");
  };

  return {
    deviceFilter,
    setDeviceFilter,
    deviceSort,
    setDeviceSort,
    deviceSearch,
    setDeviceSearch,
    deviceIntelCollapsed,
    setDeviceIntelCollapsed,
    showTopRiskOnly,
    setShowTopRiskOnly,
    selectedDevice,
    setSelectedDevice,
    copiedDevice,
    setCopiedDevice,
    lastTargetedDevice,
    setLastTargetedDevice,
    staleThresholdSec,
    deviceIntelligenceRows,
    visibleDeviceRows,
    deviceCounts,
    topRiskNames,
    heartbeatRows,
    copyDeviceName,
    isolateDevice,
    clearDeviceFocus,
    streamConnected,
    streamMode,
    feedback,
  };
}