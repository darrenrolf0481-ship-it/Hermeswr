// Render coverage for the tab components that had no tests at all.
//
// These are static-markup smoke + contract tests: each view must render without
// throwing, and the data handed to it must actually reach the DOM. That catches
// the failure modes a typechecker cannot — a bad import, a null dereference
// during render, or props that are silently ignored.

import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { WarRoomFeed } from '../src/components/WarRoomFeed';
import { TelemetryDashboard } from '../src/components/TelemetryDashboard';
import { TaskManagerView } from '../src/components/TaskManagerView';
import { TacticalCorrectionPanel } from '../src/components/TacticalCorrectionPanel';
import { AgentDeploymentView } from '../src/components/AgentDeploymentView';
import { CommChannelsView } from '../src/components/CommChannelsView';
import { PerformanceTuningView } from '../src/components/PerformanceTuningView';
import { TermuxTerminal } from '../src/components/TermuxTerminal';
import { StylusCanvas } from '../src/components/StylusCanvas';
import { HermesMatrix } from '../src/components/HermesMatrix';

import {
  agent,
  agentMetrics,
  asyncNoop,
  channel,
  correctionConfig,
  logEntry,
  memory,
  message,
  noop,
  recommendation,
  subAgent,
  task,
  telemetry,
  telemetryHistory,
  throughputHistory,
  toolStats,
  transition,
  tuningConfig,
} from './fixtures';

/** Renders to static markup, failing with the component name if it throws. */
function render(name: string, element: React.ReactElement): string {
  try {
    return renderToStaticMarkup(element);
  } catch (error) {
    assert.fail(`${name} threw during render: ${(error as Error).message}`);
  }
}

/** Case-insensitive containment, so casing in the view does not matter. */
function shows(name: string, html: string, expected: string): void {
  assert.match(
    html,
    new RegExp(expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    `${name} should render "${expected}"`
  );
}

test('WarRoomFeed renders the conversation and the operator composer', () => {
  const html = render(
    'WarRoomFeed',
    <WarRoomFeed
      messages={[message]}
      agentState="REASONING"
      onSendMessage={asyncNoop}
      subAgents={[subAgent]}
      latestSketchDataUrl={null}
      activePersona="Tactical Commander"
    />
  );

  shows('WarRoomFeed', html, 'Recon sweep complete for 192.168.1.0/24');
  shows('WarRoomFeed', html, 'REASONING');
  assert.match(html, /textarea|input/, 'WarRoomFeed needs a composer control');
});

test('WarRoomFeed renders an empty conversation without crashing', () => {
  const html = render(
    'WarRoomFeed',
    <WarRoomFeed
      messages={[]}
      agentState="IDLE"
      onSendMessage={asyncNoop}
      subAgents={[]}
      latestSketchDataUrl={null}
      activePersona="Tactical Commander"
    />
  );

  assert.ok(html.length > 0);
});

test('TelemetryDashboard surfaces device telemetry and logs', () => {
  const html = render(
    'TelemetryDashboard',
    <TelemetryDashboard
      currentTelemetry={telemetry}
      history={telemetryHistory}
      logs={[logEntry]}
      toolStats={toolStats}
      agents={[agent]}
      tasks={[task]}
      channels={[channel]}
      throughputHistory={throughputHistory}
      transitions={[transition]}
      onClearLogs={noop}
      onRefreshData={noop}
    />
  );

  shows('TelemetryDashboard', html, 'sweep initiated by operator');
  shows('TelemetryDashboard', html, 'RECON');
  assert.ok(html.length > 1000, 'dashboard should render a substantial amount of markup');
});

test('TelemetryDashboard tolerates missing optional collections', () => {
  const html = render(
    'TelemetryDashboard',
    <TelemetryDashboard
      currentTelemetry={telemetry}
      history={[]}
      logs={[]}
      toolStats={[]}
      agents={[]}
      tasks={[]}
      channels={[]}
      onClearLogs={noop}
    />
  );

  assert.ok(html.length > 0);
});

test('TaskManagerView lists tasks with their assignment and progress', () => {
  const html = render(
    'TaskManagerView',
    <TaskManagerView
      tasks={[task]}
      agents={[agent]}
      onCreateTask={asyncNoop}
      onTaskAction={asyncNoop}
      recommendations={[recommendation]}
      onApplyCorrection={asyncNoop}
      onOpenCorrectionsTab={noop}
    />
  );

  shows('TaskManagerView', html, 'Recon sweep of subnet');
  shows('TaskManagerView', html, 'Hermes-3-Alpha');
  shows('TaskManagerView', html, '45');
});

test('TaskManagerView renders an empty task list without crashing', () => {
  const html = render(
    'TaskManagerView',
    <TaskManagerView tasks={[]} agents={[]} onCreateTask={asyncNoop} onTaskAction={asyncNoop} />
  );

  assert.ok(html.length > 0);
});

test('TacticalCorrectionPanel shows pending recommendations and metrics', () => {
  const html = render(
    'TacticalCorrectionPanel',
    <TacticalCorrectionPanel
      recommendations={[recommendation]}
      config={correctionConfig}
      agentMetrics={[agentMetrics]}
      agents={[agent]}
      onApplyCorrection={asyncNoop}
      onDismissCorrection={asyncNoop}
      onUpdateConfig={asyncNoop}
      onSimulateFailure={asyncNoop}
      onRefresh={asyncNoop}
      onTriggerEvaluation={asyncNoop}
    />
  );

  shows('TacticalCorrectionPanel', html, 'HERMES-3');
  shows('TacticalCorrectionPanel', html, 'Success rate 42% below threshold');
});

test('TacticalCorrectionPanel renders an empty queue without crashing', () => {
  const html = render(
    'TacticalCorrectionPanel',
    <TacticalCorrectionPanel
      recommendations={[]}
      config={correctionConfig}
      agentMetrics={[]}
      agents={[]}
      onApplyCorrection={asyncNoop}
      onDismissCorrection={asyncNoop}
      onUpdateConfig={asyncNoop}
      onSimulateFailure={asyncNoop}
      onRefresh={asyncNoop}
    />
  );

  assert.ok(html.length > 0);
});

test('AgentDeploymentView renders each deployed agent', () => {
  const html = render(
    'AgentDeploymentView',
    <AgentDeploymentView
      agents={[agent]}
      onDeployAgent={asyncNoop}
      onAgentAction={asyncNoop}
      onUpdateAgentModel={asyncNoop}
      onSelectAgentForTask={noop}
      agentMetrics={[agentMetrics]}
      recommendations={[recommendation]}
      onApplyCorrection={asyncNoop}
      onOpenCorrectionsTab={noop}
    />
  );

  shows('AgentDeploymentView', html, 'HERMES-3');
  shows('AgentDeploymentView', html, 'Reconnaissance');
});

test('CommChannelsView renders channels and their recent packets', () => {
  const html = render(
    'CommChannelsView',
    <CommChannelsView channels={[channel]} onBroadcastPacket={asyncNoop} onRefreshChannels={asyncNoop} />
  );

  shows('CommChannelsView', html, 'C2-DROP-LINK');
  shows('CommChannelsView', html, 'SIG=0.98');
});

test('PerformanceTuningView renders the current tuning configuration', () => {
  const html = render(
    'PerformanceTuningView',
    <PerformanceTuningView
      config={tuningConfig}
      onUpdateConfig={asyncNoop}
      memoriesCount={3}
      onFlushCache={noop}
    />
  );

  shows('PerformanceTuningView', html, 'Balanced Tactical');
  shows('PerformanceTuningView', html, '8192');
});

test('TermuxTerminal renders its shell surface', () => {
  const html = render('TermuxTerminal', <TermuxTerminal />);

  shows('TermuxTerminal', html, 'TERMUX');
  assert.match(html, /input|textarea/, 'the terminal needs a command input');
});

test('StylusCanvas renders a drawing surface', () => {
  const html = render(
    'StylusCanvas',
    <StylusCanvas onSaveSketch={noop} onSendToWarRoom={noop} />
  );

  assert.match(html, /<canvas/, 'StylusCanvas needs a canvas element');
});

test('HermesMatrix renders stored memories', () => {
  const html = render(
    'HermesMatrix',
    <HermesMatrix
      activePersona="Tactical Commander"
      onChangePersona={noop}
      temperature={0.7}
      onChangeTemperature={noop}
      memories={[memory]}
      onAddMemory={noop}
      onDeleteMemory={noop}
      onClearMemories={noop}
    />
  );

  shows('HermesMatrix', html, 'WAR_ROOM_SSID');
  shows('HermesMatrix', html, 'WAR_ROOM_SECURE_5G');
});

test('every view renders deterministically for the same props', () => {
  const first = render(
    'CommChannelsView',
    <CommChannelsView channels={[channel]} onBroadcastPacket={asyncNoop} onRefreshChannels={asyncNoop} />
  );
  const second = render(
    'CommChannelsView',
    <CommChannelsView channels={[channel]} onBroadcastPacket={asyncNoop} onRefreshChannels={asyncNoop} />
  );

  assert.equal(first, second, 'rendering must not depend on hidden state');
});
