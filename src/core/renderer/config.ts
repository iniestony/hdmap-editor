import {
  Color4,
  Vector3,
  Color3,
} from "@babylonjs/core";
import {
  AtlasRoad,
  AtlasLane,
  AtlasLaneBoundaryType,
} from '../plugins/atlasConverter/type';
export default {
  scene: {
    hemisphericLightAim: new Vector3(1, 1, -1),
    frameThreshold: 60,
    clearColor: new Color4(0, 0, 0, 1.0),
    dummyGround: "dummy_ground",
    groundWidth: 50000,
    groundDepth: 50000,
    groundCellSize: 10,
    groundLineColor: new Color4(1, 1, 1, 0.5),
    groundSink: 0.5,
    groundDefaultAltitude: 16,
    xzPlaneThickness: 0.01,
    markerDiameter: 0.2,
    junctionMarkerDiameter: 0.2,
    pointCloudDefaultColor: new Color3(1, 1, 1),
    pointCloudIntensityColorPath: [new Color3(0, 0, 0), new Color3(1, 1, 1)],
    pointCloudHeightColorPath: [new Color3(1, 0, 0), new Color3(0, 1, 0)],
    pointCloudColorLinearRangeNum: 10,
    pointCloudColorIntensityBars: [0, 2, 4, 6, 8, 10, 15, 20, 25, 30, 35, 255],
    pointCloudColorIntensityMin: 0,
    pointCloudColorIntensityMax: 15,
    pointCloudColorIntensityShare: 10,
    minimumActionMeshMovement: 0.1,
    minimumGeoPositionDiffAmount: 0.0001,
    maximumSameCatmullPointDistance: 0.1,
    minimumSeparatePointDistance: 0.1,
    defaultRoadMatAlpha: 1,
  },
  firstPersonCamera: {
    inverseRotationSpeed: 0.3,
    wheelPrecisionRate: 0.3,
    target: Vector3.Zero(),
    position: new Vector3(0, 40, 50),
  },
  orbitCamera: {
    target: Vector3.Zero(),
    longitude: -Math.PI / 2,
    latitude: Math.PI / 4,
    radius: 100,
    lowerLongitude: -Infinity,
    upperLongitude: Infinity,
    lowerLatitude: 0,
    upperLatitude: Math.PI * 3 / 4,
    lowerRadius: 0,
    upperRadius: 10000,
    panningSensibility: 50,
    angularSensibilityX: 3000,
    angularSensibilityY: 3000,
    targetHeightOffset: 1000,
    targetDepthOffset: 20,
    lowerRadiusRatioOnInitRadius: 0.0001,
    upperRadiusRatioOnInitRadius: 1,
    wheelDeltaPercentage: 0.01,
    box: {
      transferX: 200,
      transferY: 250,
      transferZ: 0
    },
    birdEyeCamera: {
      beta: 0.0001
    },
    dueNorthView: {
      alpha: -Math.PI / 2
    }
  },
  mesh: {
    reflineMarkerColor: new Color3(0, 1, 0),
    laneWidthEditMarkerColor: new Color3(1, 0, 0),
    laneLineCatmullMarkerColor: new Color3(0, 0, 1),
    roadVertexMarkerColor: new Color3(1, 0.5, 0),
    pickedRoadVertexMarkerColor: new Color3(1, 0, 1),
    solidLineColor: new Color3(1, 1, 1),
    dashedLineColor: new Color3(1, 1, 0),
    roadThickness: 0.01,
    roadColor: new Color3(0.5, 0.5, 0.5),
    highlightRoadColor: new Color3(0, 0.6, 0.9),
    roadDirectionSignColor: new Color3(1, 1, 1),
    roadDirectionSignSplitLength: 100,
    roadDirectionSignInnerOuterRatio: 0.25,
    roadDirectionSignForwardRatio: 1.5,
    roadDirectionSignYOffset: -0.005,
    roadLaneSinkOffset: -0.01,
    defaultLaneWidth: 4,
    catmullStepSize: 40,
  },
  boundary: {
    laneLineColor: {
      unknown: new Color3(0, 1, 0),
      dottedYellow: new Color3(0.97, 1, 0),
      dottedWhite:  new Color3(1, 1, 1),
      solidWhite: new Color3(1, 1, 1),
      solidYellow: new Color3(0.97, 1, 0),
      doubleYellow:  new Color3(0.97, 1, 0),
      curb: new Color3(0.31, 0.33, 0),
    },
    doubleYellow: {
      roadLaneSinkOffset: 0.2,
      inner: 0.1,
      outer: -0.1,
    }
  },
  connection: {
    roadAlterPrevNextLaneMarkerYOffset: 0,
    solidLineColor: new Color3(1, 1, 1),
    initInnerReflineCatmullPointsNum: 1,
  },
  junction: {
    solidLineColor: new Color3(1, 1, 1),
    highlightSolidLineColor: new Color3(0, 0.6, 0.9),
    edgeCatmullMarkerColor: new Color3(0, 0, 1),
    maximumInitConnectionTurnMeasure: 0.8,
  },
  lineAndCurve: {
    serieSteps: 200,
  },
  atlas: {
    defaultMapFileName: 'base_map.bin',
  },
  frame: {
    nextTickGapWaitingTimeout: 100,
    nextTickGapFrames: 15,
    firstSceneTileOffset: 2,
    crossFrameTaskGapWaitingTimeout: 10,
    crossFrameMaximumParallelTask: 2,
  },
  catmullSerie: {
    maximumCatmullStepSizeForSeriePoints: 50,
    overHandlePreAndPostDistanceOnSegmentDistanceRatio: 6,
    maximumCatmullLaneLineSerieIntersectionNum: 3,
    cutCatmullPositionOffset: 0.1,
  },
  hermiteSerie: {
    hermiteTangentExtendDistance: 5,
    controlRefineRatio: 25,
  },
  renderOrder: {
    LOW: 0,
    MEDIUM_LOW: 1,
    MEDIUM: 2,
    MEDIUM_HIGH: 3,
    HIGH: 4,
  },
  laneAttrDefaultValue: {
    roadLane: {
      atlasLaneSpeedLimit: 60,
      atlasLaneType: AtlasLane.LaneType.CITY_DRIVING,
      atlasLaneTurn: AtlasLane.LaneTurn.NO_TURN,
      atlasLaneDirection: AtlasLane.LaneDirection.FORWARD,
    },
    roadLaneLine: {
      atlasLaneBoundaryVirtual: false,
      atlasLaneBoundaryType: AtlasLaneBoundaryType.Type.DOTTED_WHITE,
    },
    roadLaneLineInJunction: {
      atlasLaneBoundaryVirtual: true,
      atlasLaneBoundaryType: AtlasLaneBoundaryType.Type.UNKNOWN,
    }
  },
  pointAlign: {
    maximumDistanceQuantity: 10,
    pointMesh: {
      color: new Color3(1, 0, 0),
    },
  },
  segmentAlign: {
    pointMesh: {
      color: new Color3(1, 0, 0),
    },
    lineMesh: {
      color: new Color3(0.87, 0.98, 0.06),
    }
  },
  align: {
    mouse: {
      move: {
        las2DSize: 60000,
        pointMesh:{
          color: new Color3(0.8, 1, 0),
        },
      },
    }
  },
  altitude: {
    rawInertia: 0,
    radiusInertia: 0,
    markerDiameter: 0.4,
    cameraBetaOffset: -0.01,
    axisProjectionAltitudeRange: 0.99,
    wheelDeltaPercentage: 0.05,
    serieControlOffset: 3,
  },
  trafficLights: {
    defaultSignalWidth: 0.5,
    defaultSignalHeight: 2,
    signalPanelColor: new Color3(0.8, 0.8, 0.8),
    signalPanelAlpha: 1,
    subSignalDiameter: 0.2,
  },
};