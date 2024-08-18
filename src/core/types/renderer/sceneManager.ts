import {
  Engine,
  Scene,
} from "@babylonjs/core";

export interface ISceneManager {
  getContextEngine(): Engine,
  getContextScene(): Scene,
};

export enum CameraCategory {
  Orbit,
  FirstPerson,
};