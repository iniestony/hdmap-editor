import { useState, useCallback, useEffect, useMemo } from "react";
import { Row, Col, Space, Button, Switch, Radio, Tooltip, Divider, Typography, Slider, InputNumber, message, Form, Spin } from "antd";
import { ArrowLeftOutlined, ArrowRightOutlined, SaveOutlined, DownloadOutlined } from "@ant-design/icons";
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
import { AlterInteractionModeEvent } from '../../../../core/plugins/interactorManager/constant';
import { InteractionMode } from '../../../../core/plugins/interactorManager/type';
import { AlterPickItemUpCategoryEvent } from '../../../../core/plugins/mouseInteractor/constant';
import { PickItemUpCategory } from '../../../../core/plugins/mouseInteractor/type';
import { AlterGlobalRoadMatAlphaEvent } from '../../../../business/plugins/preProcessor/constant';
import { LASVizOption, LASIntensitySection } from '../../../../core/plugins/lasLoader/type';
import { AlterLASVizOptionEvent, AlterLASEnableEvent, AlterLASPointSizeEvent, AlterLASIntensitySectionEvent } from '../../../../core/plugins/octreeLoader/constant';
import { AlterCameraVisualAngleEvent } from '../../../../core/plugins/cameraManager/constant';
import { OrbitCameraVisualAngle } from '../../../../core/plugins/cameraManager/type'
import { InitAlignOctreeInfoEvent } from '../../../../core/plugins/octreeLoader/constant';
import { PCSCrossFrameTaskStartEvent, PCSCrossFrameTaskEndEvent } from '../../../../core/plugins/crossFrameRenderer/constant';
import RendererConfig from '../../../../core/renderer/config';
import './index.scss';


function ControlPanel(props: RenderedFuncCompProps) {
  const [interactionMode, setInteractionMode] = useState<InteractionMode>(InteractionMode.Roam);

  const [lasVizOption, setLASVizOption] = useState<LASVizOption>(LASVizOption.Intensity);

  const [lasIntensitySection, setLasIntensitySection] = useState<LASIntensitySection>({
    min: RendererConfig.scene.pointCloudColorIntensityMin,
    max: RendererConfig.scene.pointCloudColorIntensityMax,
  });

  const [lasVizEnable, setLASVizEnable] = useState<boolean>(true);

  const [lasPointSize, setLASPointSize] = useState<number>(1);

  const [lasPointCloudLoading, setLASPointCloudLoading] = useState<boolean>(false);

  const [pickItemUpCategory, setPickItemUpCategory] = useState<PickItemUpCategory>(PickItemUpCategory.Road);

  const [globalRoadMatAlpha, setGlobalRoadMatAlpha] = useState<number>(RendererConfig.scene.defaultRoadMatAlpha);


  useEffect(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;

    pScope.onEvent(
      PCSCrossFrameTaskStartEvent,
      (params: { payload: Object | string | number | null }) => {
        setLASPointCloudLoading(true);
      }
    );

    pScope.onEvent(
      PCSCrossFrameTaskEndEvent,
      (params: { payload: Object | string | number | null }) => {
        setLASPointCloudLoading(false);
      }
    );

    pScope.onEvent(
      AlterInteractionModeEvent,
      (params: { payload: Object | string | number | null }) => {
        const interactionMode = params.payload as InteractionMode;
        setInteractionMode(interactionMode);
      }
    );

    pScope.onEvent(
      AlterLASVizOptionEvent,
      (params: { payload: Object | string | number | null }) => {
        const payload = params.payload as { lasVizOption: LASVizOption };
        setLASVizOption(payload.lasVizOption);
      }
    );

    pScope.onEvent(
      AlterPickItemUpCategoryEvent,
      (params: { payload: Object | string | number | null }) => {
        const payload = params.payload as { onRoadLevel: PickItemUpCategory };
        setPickItemUpCategory(payload.onRoadLevel);
      }
    );

    pScope.onEvent(
      AlterGlobalRoadMatAlphaEvent,
      (params: { payload: Object | string | number | null }) => {
        const payload = params.payload as number;
        setGlobalRoadMatAlpha(payload);
      }
    );
  }, []);


  const alterInteractionMode = useCallback(
    (mode: InteractionMode) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      pScope.disposeAllDrawers();
      pScope.emitEvent(AlterInteractionModeEvent, mode);

      if (mode == InteractionMode.DrawPointAlign || mode === InteractionMode.DrawSegmentAlign) {
        pScope.emitEvent(InitAlignOctreeInfoEvent, { interactionMode: mode });
      }

      setInteractionMode(mode);
    },
    [props.pScope]
  );

  const alterPickItemUpCategory = useCallback(
    (pickItemUpCategory: PickItemUpCategory) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      pScope.emitEvent(AlterPickItemUpCategoryEvent, { pickItemUpCategory });
      setPickItemUpCategory(pickItemUpCategory);
    },
    [props.pScope]
  );

  const alterGlobalRoadMatAlpha = useCallback(
    (globalRoadMatAlpha: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      pScope.emitEvent(AlterGlobalRoadMatAlphaEvent, globalRoadMatAlpha);
      pScope.alterAllRoadsAndJunctionsMatAlphaAction(globalRoadMatAlpha);

      setGlobalRoadMatAlpha(globalRoadMatAlpha);
    },
    [props.pScope]
  );

  const exitEditRoad = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitEditRoad();
  }, [props.pScope]);

  const exitEditRoadLane = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitEditRoadLane();
  }, [props.pScope]);

  const exitEditRoadConnectionLane = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitEditRoadConnectionLane();
  }, [props.pScope])

  const exitEditRoadConnection = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitEditRoadConnection();
  }, [props.pScope]);

  const exitEditJunction = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitEditJunction();
  }, [props.pScope]);

  const exitEditSignal = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitEditSignal();
  }, [props.pScope]);


  const performTransactionUndo = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;

    pScope.performTransactionUndo();
  }, [props.pScope]);

  const performTransactionRedo = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;

    pScope.performTransactionRedo();
  }, [props.pScope]);

  const performPersistAllDirtyItems = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;

    pScope.makeSceneUnDirty();
    pScope.performPersistAllDirtyItems();
  }, [props.pScope]);

  const performApolloOutput = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;

    pScope.makeSceneUnDirty();
    pScope.convertToApolloMapAndDownload();
    pScope.notifySuccess("导出成功");
  }, [props.pScope]);

  const alterPointCloudVizOption = useCallback(
    (lasVizOption: LASVizOption) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      setLASVizOption(lasVizOption);

      pScope.emitEvent(AlterLASVizOptionEvent, { lasVizOption });

      // pScope.nextTick(() => {
      //   pScope.emitEvent(AlterLASVizOptionEvent, { lasVizOption });
      // });
    },
    [props.pScope]
  );

  const alterPointCloudVizEnable = useCallback(
    (enable: boolean) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      setLASVizEnable(enable);

      pScope.emitEvent(AlterLASEnableEvent, { enable });

      // pScope.nextTick(() => {
      //   pScope.emitEvent(AlterLASEnableEvent, { enable });
      // });
    },
    [props.pScope]
  );

  const alterPointCloudPointSizeRenderAction = useCallback(
    (props.pScope as unknown as ExtendedNamespace).makeDebounce((size: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      // pScope.nextTick(() => {
      //   pScope.emitEvent(AlterLASPointSizeEvent, { size });
      // });

      pScope.emitEvent(AlterLASPointSizeEvent, { size });
    }, 500),
    [props.pScope]
  );

  const alterPointCloudPointSize = useCallback(
    (size: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;

      setLASPointSize(size);

      alterPointCloudPointSizeRenderAction(size);
    },
    [props.pScope]
  );

  const alterCameraVisualAngle = useCallback((orbitCameraVisualAngle: OrbitCameraVisualAngle) => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.emitEvent(AlterCameraVisualAngleEvent, { orbitCameraVisualAngle });
  }, [props.pScope]);

  const enterDrawRoadConnection = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.enterDrawRoadConnection();
  }, [props.pScope]);

  const exitDrawRoadConnection = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitDrawRoadConnection();
  }, [props.pScope]);

  const cleanPickedRoadVertices = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.cleanPickedRoadVertices();
  }, [props.pScope]);



  const cleanPickedPrevAndNextConnectionLaneVertices = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.cleanPickedPrevAndNextConnectionLaneVertices();
  }, [props.pScope]);

  const cleanNewLanePrevAndNextConnectionLaneVertices = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.cleanNewLanePrevAndNextConnectionLaneVertices();
  }, [props.pScope]);

  const enterDrawJunction = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.enterDrawJunction();
  }, [props.pScope]);

  const exitDrawJunction = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.exitDrawJunction();
  }, [props.pScope]);

  const cleanPickedJunctionVertices = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.cleanPickedJunctionVertices();
  }, [props.pScope]);

  const confirmPickedJunctionVertices = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.confirmPickedJunctionVertices();
  }, [props.pScope]);

  const cleanNewRoadPrevAndNextConnectionRoadVertices = useCallback(() => {
    const pScope = props.pScope as unknown as ExtendedNamespace;
    pScope.cleanNewRoadPrevAndNextConnectionRoadVertices();
  }, [props.pScope]);



  const intensityFinish = useCallback(
    (lasIntensitySection: LASIntensitySection) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;
      if (lasIntensitySection.max > lasIntensitySection.min) {
        setLasIntensitySection(lasIntensitySection);

        pScope.emitEvent(AlterLASIntensitySectionEvent, { lasIntensitySection });

        // pScope.nextTick(() => {
        //   pScope.emitEvent(AlterLASIntensitySectionEvent, { lasIntensitySection });
        // });
      } else {
        pScope.notifyInfo('min需要少于max');
      }
    }, [props.pScope, lasVizOption, lasIntensitySection])

  const IntensitySectionUi = useCallback(() => {
    if (lasVizOption === LASVizOption.Intensity) {
      return (
        <>
          <div className="editor-intensity">
            <Form
              name="customized_form_controls"
              layout="inline"
              onFinish={(e) => {
                intensityFinish(e)
              }}
              initialValues={lasIntensitySection}
            >
              <Form.Item name="min" label="min">
                <InputNumber
                  className="lasIntensitySectionMin"
                  size="small"
                  style={{ width: "70px" }}
                  min={0}
                  max={255}
                />
              </Form.Item>
              <Form.Item name="max" label="max">
                <InputNumber
                  className="lasIntensitySectionMax"
                  size="small"
                  style={{ width: "70px" }}
                  min={0}
                  max={255}
                />
              </Form.Item>
              <Form.Item>
                <Button className="lasIntensitySectionBtn" type="primary" htmlType="submit" size="small">
                  确定
                </Button>
              </Form.Item>
            </Form>
          </div>
        </>
      )
    }
  }, [props.pScope, lasVizOption, lasIntensitySection])

  const toolbarUi = useMemo(() => {
    const save = (
      <Space>
        <Tooltip title="保存" placement="bottom" color="blue">
          <Button
            shape="circle"
            icon={<SaveOutlined />}
            onClick={() => {
              performPersistAllDirtyItems();
            }}
          ></Button>
        </Tooltip>
      </Space>
    );

    const output = (
      <Space>
        <Tooltip title="输出Apollo HDMap" placement="bottom" color="blue">
          <Button
            shape="circle"
            icon={<DownloadOutlined />}
            onClick={() => {
              performApolloOutput();
            }}
          ></Button>
        </Tooltip>
      </Space>
    );

    const undoRedo = (
      <Space>
        <Tooltip title="Undo" placement="bottom" color="blue">
          <Button
            shape="circle"
            icon={<ArrowLeftOutlined />}
            onClick={() => {
              performTransactionUndo();
            }}
          ></Button>
        </Tooltip>
        <Tooltip title="Redo" placement="bottom" color="blue">
          <Button
            shape="circle"
            icon={<ArrowRightOutlined />}
            onClick={() => {
              performTransactionRedo();
            }}
          ></Button>
        </Tooltip>
      </Space>
    );

    if (interactionMode === InteractionMode.EditRoad) {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Space>
              <Button
                onClick={() => {
                  exitEditRoad();
                }}
              >
                退出编辑道路
              </Button>
            </Space>
          </Space>
        </>
      )
    } else if (interactionMode === InteractionMode.EditRoadLane) {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Space>
              <Button
                onClick={() => {
                  exitEditRoadLane();
                }}
              >
                退出编辑车道
              </Button>
            </Space>
          </Space>
        </>
      )
    } else if (interactionMode === InteractionMode.DrawConnectionRoad) {
      return (
        <>
          {save}
          {/* {output} */}
          <Space>
            <Space>
              <Button
                key="exitDrawRoadConnection"
                onClick={() => {
                  exitDrawRoadConnection();
                }}
              >
                退出道路连接
              </Button>
              <Button
                key="cleanPickedRoadVertices"
                onClick={() => {
                  cleanPickedRoadVertices();
                }}
              >
                清除道路选择
              </Button>
            </Space>
          </Space>
        </>
      )
    } else if (interactionMode === InteractionMode.EditConnectionRoad) {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Space>
              <Button
                key="exitEditRoadConnection"
                onClick={() => {
                  exitEditRoadConnection();
                }}
              >
                退出编辑道路连接
              </Button>
              <Button
                key="cleanNewLanePrevAndNextConnectionLaneVertices"
                onClick={() => {
                  cleanNewLanePrevAndNextConnectionLaneVertices();
                }}
              >
                清除新增车道选择
              </Button>
            </Space>
          </Space>
        </>
      )
    } else if (interactionMode === InteractionMode.EditRoadConnectionLane) {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Space>
              <Button
                key="exitEditRoadConnectionLane"
                onClick={() => {
                  exitEditRoadConnectionLane();
                }}
              >
                退出编辑车道连接
              </Button>
              <Button
                key="cleanPickedPrevAndNextConnectionLaneVertices"
                onClick={() => {
                  cleanPickedPrevAndNextConnectionLaneVertices();
                }}
              >
                清除车道选择
              </Button>
            </Space>
          </Space>
        </>
      )
    } else if (interactionMode === InteractionMode.DrawJunction) {
      return (
        <>
          {save}
          {/* {output} */}
          <Space>
            <Space>
              <Button
                key="exitDrawJunction"
                onClick={() => {
                  exitDrawJunction();
                }}
              >
                退出路口连接
              </Button>
              <Button
                key="cleanPickedJunctionVertices"
                onClick={() => {
                  cleanPickedJunctionVertices();
                }}
              >
                清除道路选择
              </Button>
              <Button
                key="confirmPickedJunctionVertices"
                onClick={() => {
                  confirmPickedJunctionVertices();
                }}
              >
                确认道路选择
              </Button>
            </Space>
          </Space>
        </>
      )
    } else if (interactionMode === InteractionMode.EditJunction) {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Space>
              <Button
                key="exitEditJunction"
                onClick={() => {
                  exitEditJunction();
                }}
              >
                退出编辑路口
              </Button>
              <Button
                key="cleanNewRoadPrevAndNextConnectionRoadVertices"
                onClick={() => {
                  cleanNewRoadPrevAndNextConnectionRoadVertices();
                }}
              >
                清除道路选择
              </Button>
            </Space>
          </Space>
        </>
      )
    }  else if (interactionMode === InteractionMode.EditTrafficLights) {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Space>
              <Button
                key="exitEditSignal"
                onClick={() => {
                  exitEditSignal();
                }}
              >
                退出编辑红绿灯
              </Button>
            </Space>
          </Space>
        </>
      )
    } else {
      return (
        <>
          {save}
          {/* {output} */}
          {undoRedo}
          <Space>
            <Button
              shape="round"
              type={
                interactionMode === InteractionMode.Roam
                  ? "primary"
                  : "default"
              }
              onClick={() => {
                alterInteractionMode(InteractionMode.Roam);
              }}
            >
              漫游
            </Button>

            <Button
              shape="round"
              type={
                interactionMode === InteractionMode.DrawCatmullSerieRoad
                  ? "primary"
                  : "default"
              }
              onClick={() => {
                alterInteractionMode(InteractionMode.DrawCatmullSerieRoad);
              }}
            >
              绘制道路
            </Button>
          </Space>

          <Space>
            <Button
              shape="round"
              onClick={() => {
                enterDrawRoadConnection();
              }}
            >
              连接道路
            </Button>
            <Button
              shape="round"
              onClick={() => {
                enterDrawJunction();
              }}
            >
              绘制路口
            </Button>
          </Space>

          <Space>
            <Button
              shape="round"
              type={
                interactionMode === InteractionMode.DrawPointAlign
                  ? "primary"
                  : "default"
              }
              onClick={() => {
                alterInteractionMode(InteractionMode.DrawPointAlign);
              }}
            >
              点测量
            </Button>
            <Button
              shape="round"
              type={
                interactionMode === InteractionMode.DrawSegmentAlign
                  ? "primary"
                  : "default"
              }
              onClick={() => {
                alterInteractionMode(InteractionMode.DrawSegmentAlign);
              }}
            >
              线段测量
            </Button>
          </Space>

          <Space>
            <Button
              shape="round"
              type={
                interactionMode === InteractionMode.DrawTrafficLights
                  ? "primary"
                  : "default"
              }
              onClick={() => {
                alterInteractionMode(InteractionMode.DrawTrafficLights);
              }}
            >
              绘制红绿灯
            </Button>
          </Space>
        </>
      )
    }
  }, [interactionMode]);


  return (
    <>
      <div className="editor-toolbar">
        <Space direction="vertical">
          <Space size="large">
            {toolbarUi}
          </Space>
        </Space>

        <div className="editor-pcd-loading">
          <Spin
            size={'default'}
            tip={'点云渲染中'}
            spinning={lasPointCloudLoading}
          />
        </div>
      </div>
      <div className="editor-status">
        <Space size="large" align="center">
          <Space>
            <span>拾取单元</span>
            <Radio.Group onChange={(v) => {
              alterPickItemUpCategory(v.target.value);
            }} value={pickItemUpCategory} buttonStyle="solid" size="small">
              <Radio.Button value={PickItemUpCategory.Road}>道路</Radio.Button>
              <Radio.Button value={PickItemUpCategory.Lane}>车道</Radio.Button>
              <Radio.Button value={PickItemUpCategory.Junction}>路口</Radio.Button>
              <Radio.Button value={PickItemUpCategory.Signal}>红绿灯</Radio.Button>
            </Radio.Group>
          </Space>
          <Space>
            <span>道路透明</span>
            <Switch
              checkedChildren="是"
              unCheckedChildren="否"
              checked={globalRoadMatAlpha === 0}
              onChange={(v) => {
                alterGlobalRoadMatAlpha(v ? 0 : 1);
              }}
            />
          </Space>
          <Space >
            <Button shape="round" size="small" onClick={(v) => {
              alterCameraVisualAngle(OrbitCameraVisualAngle.BirdEyeView);
            }}>俯视视角
            </Button>
            <Button shape="round" size="small" onClick={(v) => {
              alterCameraVisualAngle(OrbitCameraVisualAngle.DueNorthView);
            }}>正北视角
            </Button>
          </Space>
          <Space>
            <span>显示点云</span>
            <Switch
              checkedChildren="显示"
              unCheckedChildren="隐藏"
              checked={lasVizEnable}
              onChange={(v) => {
                alterPointCloudVizEnable(v);
              }}
            />
          </Space>

          <Space>
            <span>点云颜色</span>
            <Radio.Group
              options={[
                { label: "intensity", value: LASVizOption.Intensity },
                { label: "height", value: LASVizOption.Height },
              ]}
              value={lasVizOption}
              optionType="button"
              buttonStyle="solid"
              size="small"
              onChange={(e) => alterPointCloudVizOption(e.target.value)}
            />
            {IntensitySectionUi()}
          </Space>

          <Space>
            <span>点云尺寸</span>
            <div className="slider-container">
              <Slider
                min={1}
                max={5}
                step={0.1}
                value={lasPointSize}
                onChange={(v: number) => {
                  alterPointCloudPointSize(v);
                }}
              />
            </div>
          </Space>
        </Space>
      </div>
    </>
  );
};

export default ControlPanel;