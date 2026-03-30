import { useEffect, useMemo, useRef, useState } from "react";
import type {
  FaultFormState,
  FaultPresetKey,
  FaultType,
  FeedbackTone,
  SeverityType,
  SimulatorStatus,
} from "./AdminTypes";
import {
  buildActiveFaultAgeSec,
  buildActiveFaultAgeText,
  buildActiveFaultHiddenTargets,
  buildActiveFaultPresetName,
  buildActiveFaultTargetNames,
  buildActiveFaultVisibleTargets,
  buildAvailableFaultDevices,
  buildDraftDiffersFromActiveFault,
  buildFaultTargetList,
  buildFilteredVisibleDeviceNames,
  buildTopRiskVisibleDeviceNames,
} from "./adminSimulatorHelpers";
import { postAdminAction } from "./adminSimulatorApi";

export function useFaultWorkflowController(params: {
  faultForm: FaultFormState;
  setFaultForm: React.Dispatch<React.SetStateAction<FaultFormState>>;
  status: SimulatorStatus | null;
  availableDevices: string[];
  selectedFaultDevice: string | null;
  setSelectedFaultDevice: React.Dispatch<React.SetStateAction<string | null>>;
  setFeedback: (type: FeedbackTone, message: string) => void;
  setActionMessage: React.Dispatch<React.SetStateAction<string>>;
  refreshAll: () => Promise<void>;
  postAction: (
    endpoint: string,
    body?: Record<string, unknown>,
    successFallback?: string,
    errorFallback?: string,
  ) => Promise<any>;
}) {
  const {
    faultForm,
    setFaultForm,
    status,
    availableDevices,
    selectedFaultDevice,
    setSelectedFaultDevice,
    setFeedback,
    setActionMessage,
    refreshAll,
    postAction,
  } = params;

  const [savedFaultPreset, setSavedFaultPreset] = useState<string[]>([]);
  const [savedFaultPresetSeverity, setSavedFaultPresetSeverity] =
    useState<SeverityType>("medium");
  const [savedFaultPresetType, setSavedFaultPresetType] =
    useState<FaultType>("high_temp");
  const [faultDrillUntil, setFaultDrillUntil] = useState<string | null>(null);
  const faultDrillTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showFaultStartConfirm, setShowFaultStartConfirm] = useState(false);
  const [pendingPresetStart, setPendingPresetStart] = useState<{
    preset: FaultPresetKey;
    autoStopSeconds?: number;
  } | null>(null);
  const [faultDrillRemainingSec, setFaultDrillRemainingSec] = useState<number | null>(null);

  const faultMode = status?.faultMode ?? null;

  const faultTargetList = useMemo(
    () => buildFaultTargetList(faultForm.targetDevicesText),
    [faultForm.targetDevicesText],
  );

  const availableFaultDevices = useMemo(
    () => buildAvailableFaultDevices(availableDevices, []),
    [availableDevices],
  );

  const filteredVisibleDeviceNames = useMemo(
    () => buildFilteredVisibleDeviceNames([]),
    [],
  );

  const topRiskVisibleDeviceNames = useMemo(
    () => buildTopRiskVisibleDeviceNames([]),
    [],
  );

  const activeFaultTargetNames = useMemo(
    () => buildActiveFaultTargetNames(status),
    [status],
  );

  const draftDiffersFromActiveFault = useMemo(
    () =>
      buildDraftDiffersFromActiveFault(
        status,
        faultTargetList,
        faultForm.faultType,
        faultForm.severity,
      ),
    [status, faultTargetList, faultForm.faultType, faultForm.severity],
  );

  const activeFaultAgeSec = useMemo(() => buildActiveFaultAgeSec(status), [status]);

  const activeFaultAgeText = useMemo(
    () => buildActiveFaultAgeText(activeFaultAgeSec),
    [activeFaultAgeSec],
  );

  const activeFaultPresetName = useMemo(
    () => buildActiveFaultPresetName(status),
    [status],
  );

  const activeFaultVisibleTargets = useMemo(
    () => buildActiveFaultVisibleTargets(activeFaultTargetNames, []),
    [activeFaultTargetNames],
  );

  const activeFaultHiddenTargets = useMemo(
    () => buildActiveFaultHiddenTargets(activeFaultTargetNames, []),
    [activeFaultTargetNames],
  );

  const syncFaultDevicesInput = (devices: string[]) => {
    const cleaned = Array.from(new Set(devices.map((d) => d.trim()).filter(Boolean)));
    setFaultForm((prev) => ({
      ...prev,
      targetDevicesText: cleaned.join(","),
    }));
  };

  const setFaultType = (faultType: FaultType) => {
    setFaultForm((prev) => ({ ...prev, faultType }));
  };

  const setFaultSeverity = (severity: SeverityType) => {
    setFaultForm((prev) => ({ ...prev, severity }));
  };

  const setFaultDevicesInput = (targetDevicesText: string) => {
    setFaultForm((prev) => ({ ...prev, targetDevicesText }));
  };

  useEffect(() => {
    if (!faultForm.targetDevicesText && availableDevices.length > 0) {
      setFaultDevicesInput(availableDevices[0]);
    }
  }, [faultForm.targetDevicesText, availableDevices]);

  const addFaultTargetChip = (deviceName: string) => {
    if (!deviceName.trim()) return;
    if (faultTargetList.includes(deviceName)) {
      setFeedback("info", `${deviceName} is already in target devices`);
      return;
    }
    syncFaultDevicesInput([...faultTargetList, deviceName]);
    setSelectedFaultDevice(deviceName);
    setActionMessage(`Added ${deviceName} to fault targets.`);
    setFeedback("success", `Added fault target: ${deviceName}`);
  };

  const removeFaultTargetChip = (deviceName: string) => {
    syncFaultDevicesInput(faultTargetList.filter((d) => d !== deviceName));
    if (selectedFaultDevice === deviceName) {
      setSelectedFaultDevice(null);
    }
    setFeedback("info", `Removed fault target: ${deviceName}`);
  };

  const clearFaultTargets = () => {
    setFaultDevicesInput("");
    setSelectedFaultDevice(null);
    setFeedback("info", "Cleared all fault targets");
  };

  const useFilteredDevicesAsTargets = () => {
    if (!filteredVisibleDeviceNames.length) {
      setFeedback("error", "No visible devices to use as targets");
      return;
    }
    syncFaultDevicesInput(filteredVisibleDeviceNames);
    setFeedback(
      "success",
      `Loaded ${filteredVisibleDeviceNames.length} filtered device(s) as targets`,
    );
  };

  const useTopRiskDevicesAsTargets = () => {
    if (!topRiskVisibleDeviceNames.length) {
      setFeedback("error", "No top risk devices available");
      return;
    }
    syncFaultDevicesInput(topRiskVisibleDeviceNames);
    setFeedback(
      "success",
      `Loaded ${topRiskVisibleDeviceNames.length} top risk device(s) as targets`,
    );
  };

  const useActiveFaultTargets = () => {
    if (!activeFaultTargetNames.length) {
      setFeedback("error", "No active fault targets found");
      return;
    }
    syncFaultDevicesInput(activeFaultTargetNames);
    setFeedback(
      "success",
      `Loaded ${activeFaultTargetNames.length} active fault target(s)`,
    );
  };

  const saveFaultDraftPreset = () => {
    if (!faultTargetList.length) {
      setFeedback("error", "No target devices to save");
      return;
    }
    setSavedFaultPreset(faultTargetList);
    setSavedFaultPresetSeverity(faultForm.severity);
    setSavedFaultPresetType(faultForm.faultType);
    setFeedback(
      "success",
      `Saved preset with ${faultTargetList.length} target device(s)`,
    );
  };

  const loadFaultDraftPreset = () => {
    if (!savedFaultPreset.length) {
      setFeedback("error", "No saved preset available");
      return;
    }
    syncFaultDevicesInput(savedFaultPreset);
    setFaultSeverity(savedFaultPresetSeverity);
    setFaultType(savedFaultPresetType);
    setFeedback(
      "success",
      `Loaded preset with ${savedFaultPreset.length} target device(s)`,
    );
  };

  const clearSavedFaultPreset = () => {
    setSavedFaultPreset([]);
    setSavedFaultPresetSeverity("medium");
    setSavedFaultPresetType("high_temp");
    setFeedback("info", "Cleared saved fault preset");
  };

  const applySeverityPreset = (severity: SeverityType) => {
    setFaultSeverity(severity);
    setFeedback("info", `Severity preset set to ${severity}`);
  };

  const resolveFaultPreset = (preset: FaultPresetKey) => {
    const draftTargets = faultTargetList;

    const pickTargets = (preferred: string[]) => {
      if (draftTargets.length > 0) return draftTargets;
      if (preferred.length > 0) return preferred;
      if (availableFaultDevices.length > 0) return [availableFaultDevices[0]];
      return [];
    };

    if (preset === "hot_spike") {
      return {
        faultType: "high_temp" as FaultType,
        severity: "high" as SeverityType,
        targets: pickTargets([]),
        label: "Hot Spike",
      };
    }
    if (preset === "sensor_freeze") {
      return {
        faultType: "stuck_temp" as FaultType,
        severity: "medium" as SeverityType,
        targets: pickTargets([]),
        label: "Sensor Freeze",
      };
    }
    if (preset === "drift_test") {
      return {
        faultType: "drift_up" as FaultType,
        severity: "medium" as SeverityType,
        targets: pickTargets([]),
        label: "Drift Test",
      };
    }
    return {
      faultType: "offline" as FaultType,
      severity: "high" as SeverityType,
      targets: pickTargets([]),
      label: "Offline Drill",
    };
  };

  const applyFaultPreset = (preset: FaultPresetKey) => {
    const resolved = resolveFaultPreset(preset);
    setFaultType(resolved.faultType);
    setFaultSeverity(resolved.severity);
    syncFaultDevicesInput(resolved.targets);
    setFeedback(
      "success",
      `Preset applied: ${resolved.label}${resolved.targets.length ? ` (${resolved.targets.length} target)` : ""}`,
    );
  };

  const getPresetHint = (preset: FaultPresetKey) => {
    if (preset === "hot_spike") return "High temp + high severity";
    if (preset === "sensor_freeze") return "Stuck temperature + medium severity";
    if (preset === "drift_test") return "Upward drift + medium severity";
    return "Offline simulation + high severity";
  };

  const resetFaultDraft = () => {
    const fallbackDevice = availableDevices[0] ?? "sensor_01";
    setFaultForm({
      faultType: "high_temp",
      severity: "medium",
      targetDevicesText: fallbackDevice,
    });
    setSelectedFaultDevice(fallbackDevice);
    setFeedback("info", "Fault draft reset to safe defaults");
  };

  const cancelActiveDrill = () => {
    if (faultDrillTimeoutRef.current) {
      clearTimeout(faultDrillTimeoutRef.current);
      faultDrillTimeoutRef.current = null;
    }
    setFaultDrillUntil(null);
    setFaultDrillRemainingSec(null);
    setFeedback("info", "Cancelled local drill timer");
  };

  const startFaultMode = async () => {
    const targetDevices = faultTargetList;

    if (!targetDevices.length) {
      setFeedback("error", "Please enter at least one target device");
      return;
    }

    if (availableDevices.length > 0) {
      const invalidDevices = targetDevices.filter((d) => !availableDevices.includes(d));
      if (invalidDevices.length) {
        setFeedback("error", `Invalid target device(s): ${invalidDevices.join(", ")}`);
        return;
      }
    }

    await postAction(
      "/simulator/fault/start",
      {
        fault_type: faultForm.faultType,
        target_devices: targetDevices,
        severity: faultForm.severity,
        config: {},
      },
      "Sustained fault mode started",
      "Failed to start sustained fault mode",
    );

    await refreshAll();
    setActionMessage("Sustained fault mode started.");
  };

  const stopFaultMode = async () => {
    if (faultDrillTimeoutRef.current) {
      clearTimeout(faultDrillTimeoutRef.current);
      faultDrillTimeoutRef.current = null;
    }
    setFaultDrillUntil(null);
    setFaultDrillRemainingSec(null);

    await postAction(
      "/simulator/fault/stop",
      undefined,
      "Sustained fault mode stopped",
      "Failed to stop sustained fault mode",
    );

    await refreshAll();
    setActionMessage("Sustained fault mode stopped.");
  };

  const applyPresetAndMaybeStart = async (
    preset: FaultPresetKey,
    options?: { autoStart?: boolean; autoStopSeconds?: number; skipConfirm?: boolean },
  ) => {
    const resolved = resolveFaultPreset(preset);

    setFaultType(resolved.faultType);
    setFaultSeverity(resolved.severity);
    syncFaultDevicesInput(resolved.targets);

    const autoStart = Boolean(options?.autoStart);
    const autoStopSeconds = options?.autoStopSeconds ?? 0;
    const skipConfirm = Boolean(options?.skipConfirm);

    if (!autoStart) {
      setFeedback(
        "success",
        `Preset applied: ${resolved.label}${resolved.targets.length ? ` (${resolved.targets.length} target)` : ""}`,
      );
      return;
    }

    if (!status?.running) {
      setFeedback("error", "Start the simulator before executing fault presets");
      return;
    }

    if (status?.paused) {
      setFeedback("error", "Resume the simulator before executing fault presets");
      return;
    }

    if (!resolved.targets.length) {
      setFeedback("error", "No valid target devices available for preset execution");
      return;
    }

    if (availableDevices.length > 0) {
      const invalidDevices = resolved.targets.filter((d) => !availableDevices.includes(d));
      if (invalidDevices.length > 0) {
        setFeedback("error", `Invalid target device(s): ${invalidDevices.join(", ")}`);
        return;
      }
    }

    if (!skipConfirm) {
      setPendingPresetStart({ preset, autoStopSeconds });
      setShowFaultStartConfirm(true);
      return;
    }

    try {
      await postAdminAction("/simulator/fault/start", {
        fault_type: resolved.faultType,
        target_devices: resolved.targets,
        severity: resolved.severity,
        config: {},
      });

      if (faultDrillTimeoutRef.current) {
        clearTimeout(faultDrillTimeoutRef.current);
        faultDrillTimeoutRef.current = null;
      }

      if (autoStopSeconds > 0) {
        const until = new Date(Date.now() + autoStopSeconds * 1000).toISOString();
        setFaultDrillUntil(until);

        faultDrillTimeoutRef.current = setTimeout(async () => {
          try {
            await postAdminAction("/simulator/fault/stop");
            await refreshAll();
            setFaultDrillUntil(null);
            faultDrillTimeoutRef.current = null;
            setFeedback("success", `${resolved.label} drill auto-stopped`);
          } catch (err) {
            console.error(err);
            setFaultDrillUntil(null);
            faultDrillTimeoutRef.current = null;
            setFeedback("error", "Failed to auto-stop drill");
          }
        }, autoStopSeconds * 1000);
      } else {
        setFaultDrillUntil(null);
      }

      setFeedback(
        "success",
        `${resolved.label} started${autoStopSeconds > 0 ? ` for ${autoStopSeconds}s` : ""}`,
      );
      await refreshAll();
    } catch (err) {
      console.error(err);
      setFeedback("error", "Failed to start preset fault mode");
    }
  };

  useEffect(() => {
    if (!faultDrillUntil) {
      setFaultDrillRemainingSec(null);
      return;
    }

    const tick = () => {
      const until = new Date(faultDrillUntil).getTime();
      if (Number.isNaN(until)) {
        setFaultDrillRemainingSec(null);
        return;
      }
      setFaultDrillRemainingSec(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [faultDrillUntil]);

  const confirmPendingPresetStart = async () => {
    if (!pendingPresetStart) return;
    const { preset, autoStopSeconds } = pendingPresetStart;
    setShowFaultStartConfirm(false);
    setPendingPresetStart(null);

    await applyPresetAndMaybeStart(preset, {
      autoStart: true,
      autoStopSeconds,
      skipConfirm: true,
    });
  };

  const cancelPendingPresetStart = () => {
    setShowFaultStartConfirm(false);
    setPendingPresetStart(null);
    setFeedback("info", "Preset execution cancelled");
  };

  return {
    faultType: faultForm.faultType,
    setFaultType,
    faultDevicesInput: faultForm.targetDevicesText,
    setFaultDevicesInput,
    faultSeverity: faultForm.severity,
    setFaultSeverity,

    savedFaultPreset,
    setSavedFaultPreset,
    savedFaultPresetSeverity,
    setSavedFaultPresetSeverity,
    savedFaultPresetType,
    setSavedFaultPresetType,

    faultDrillUntil,
    setFaultDrillUntil,
    faultDrillTimeoutRef,

    showFaultStartConfirm,
    setShowFaultStartConfirm,
    pendingPresetStart,
    setPendingPresetStart,
    faultDrillRemainingSec,
    setFaultDrillRemainingSec,

    faultMode,
    faultTargetList,
    availableFaultDevices,
    filteredVisibleDeviceNames,
    topRiskVisibleDeviceNames,
    activeFaultTargetNames,
    draftDiffersFromActiveFault,
    activeFaultAgeSec,
    activeFaultAgeText,
    activeFaultPresetName,
    activeFaultVisibleTargets,
    activeFaultHiddenTargets,

    syncFaultDevicesInput,
    addFaultTargetChip,
    removeFaultTargetChip,
    clearFaultTargets,
    useFilteredDevicesAsTargets,
    useTopRiskDevicesAsTargets,
    useActiveFaultTargets,
    saveFaultDraftPreset,
    loadFaultDraftPreset,
    clearSavedFaultPreset,
    resolveFaultPreset,
    applySeverityPreset,
    applyFaultPreset,
    getPresetHint,
    resetFaultDraft,
    cancelActiveDrill,
    startFaultMode,
    stopFaultMode,
    applyPresetAndMaybeStart,
    confirmPendingPresetStart,
    cancelPendingPresetStart,
  };
}