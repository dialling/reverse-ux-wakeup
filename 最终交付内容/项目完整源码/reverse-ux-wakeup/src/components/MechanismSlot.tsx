import React from 'react';
import {
  EvasiveGravitySlider,
  FlowConnectGame,
  ParkingJamGame,
  RaidShakingKeypad,
  ShameTyperModal,
  type EvasiveSliderProps,
  type FlowConnectProps,
  type ParkingJamProps,
  type RaidKeypadProps,
  type ShameTyperProps,
} from '../mechanisms';

export function getMountedMechanismCount(): number {
  return 5;
}

export const EvasiveGravitySliderSlot: React.FC<EvasiveSliderProps> = (props) => {
  return <EvasiveGravitySlider {...props} />;
};

export const ShameTyperModalSlot: React.FC<ShameTyperProps> = (props) => {
  return <ShameTyperModal {...props} />;
};

export const RaidShakingKeypadSlot: React.FC<RaidKeypadProps> = (props) => {
  return <RaidShakingKeypad {...props} />;
};

export const FlowConnectGameSlot: React.FC<FlowConnectProps> = (props) => {
  return <FlowConnectGame {...props} />;
};

export const ParkingJamGameSlot: React.FC<ParkingJamProps> = (props) => {
  return <ParkingJamGame {...props} />;
};
