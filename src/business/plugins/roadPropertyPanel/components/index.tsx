import { useState, useCallback, useEffect, Fragment } from "react";
import { Form, Row, Select, Col } from 'antd';
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
import {
  EnterEditingRoadItemEvent,
} from '../../../../core/plugins/roadEditor/constant';
import {
  RoadItemAttributeEdit
} from '../../../../core/plugins/roadEditor/type';
import {
  UpdateRoadAltitudeAxisEvent,
} from '../../../../core/plugins/roadAltitudeAdaptor/constant';
import {
  LineAndCurveCategory,
  LineAndCurveItem,
  LaneItem,
  RoadItem,
  RoadCategory,
  LaneSide,
  LaneLineSide,
  LaneItemKeyInfo,
  RoadItemKeyInfo,
  AddLaneSide,
} from '../../../../core/plugins/statusManager/type';
import {
  AtlasRoad,
  AtlasLane,
} from '../../../../core/plugins/atlasConverter/type';
import './index.scss';

function RoadPropertyPanel(props: RenderedFuncCompProps) {
  const [roadItemKeyInfo, setRoadItemKeyInfo] = useState<RoadItemKeyInfo | null>(null);
  const [atlasRoadType, setAtlasRoadType] = useState<AtlasRoad.Type>(AtlasRoad.Type.CITY_ROAD);
  const [leftLanes, setLeftLanes] = useState<LaneItemKeyInfo[]>([]);
  const [rightLanes, setRightLanes] = useState<LaneItemKeyInfo[]>([]);
  const [roadItemAttributeForm] = Form.useForm();

  const [altitudeInfo, setAltitudeInfo] = useState<{
    upperAltitude: number;
    lowerAltitude: number;
  }>({
    upperAltitude: 0,
    lowerAltitude: 0,
  });

  const [altitudeDistanceInfo, setAltitudeDistanceInfo] = useState<{
    leftDistance: number;
    rightDistance: number;
  }>({
    leftDistance: 0,
    rightDistance: 0,
  });

  useEffect(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    pScope.onEvent(EnterEditingRoadItemEvent, (params: { payload: Object | string | number | null }) => {
      const roadItem = (params.payload as { roadItem: RoadItem }).roadItem;
      const roadItemKeyInfo = pScope.resolveRoadItemKeyInfo(roadItem) as RoadItemKeyInfo;
      syncRoadProperty(roadItemKeyInfo);
    });

    pScope.onEvent(UpdateRoadAltitudeAxisEvent, (params: { payload: Object | string | number | null }) => {
      const payload = params.payload as {
        upperAltitude: number;
        lowerAltitude: number;
        leftDistance: number;
        rightDistance: number;
      };

      setAltitudeInfo({
        upperAltitude: payload.upperAltitude,
        lowerAltitude: payload.lowerAltitude,
      });

      setAltitudeDistanceInfo({
        leftDistance: payload.leftDistance,
        rightDistance: payload.rightDistance,
      });
    });
  }, []);

  const syncRoadProperty = useCallback((roadItemKeyInfo: RoadItemKeyInfo) => {
    setRoadItemKeyInfo(roadItemKeyInfo);
    setAtlasRoadType(roadItemKeyInfo.atlasRoadType);
    setLeftLanes(roadItemKeyInfo.laneItems.leftLanes);
    setRightLanes(roadItemKeyInfo.laneItems.rightLanes);
    roadItemAttributeForm.setFieldsValue({
      atlasRoadType: roadItemKeyInfo.atlasRoadType
    } as RoadItemAttributeEdit);
  }, []);

  const convertAtlasRoadType = useCallback((atlasRoadType: AtlasRoad.Type) => {
    if (atlasRoadType === AtlasRoad.Type.CITY_ROAD) return 'CITY_ROAD';
    if (atlasRoadType === AtlasRoad.Type.HIGHWAY) return 'HIGHWAY';
    if (atlasRoadType === AtlasRoad.Type.PARK) return 'PARK';
    return 'UNKNOWN';
  }, []);

  const convertAtlasRoadTypeToArray = useCallback(() => {
    const atlasRoadTypeToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasRoad.Type).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasRoad.Type[key]
        };
        atlasRoadTypeToArray.push(data);
      };
    });
    return atlasRoadTypeToArray;
  }, []);


  const convertAtlasLaneType = useCallback((atlasLaneType: AtlasLane.LaneType) => {
    if (atlasLaneType === AtlasLane.LaneType.CITY_DRIVING) return 'CITY_DRIVING';
    if (atlasLaneType === AtlasLane.LaneType.BIKING) return 'BIKING';
    if (atlasLaneType === AtlasLane.LaneType.PARKING) return 'PARKING';
    if (atlasLaneType === AtlasLane.LaneType.SHOULDER) return 'SHOULDER';
    if (atlasLaneType === AtlasLane.LaneType.SIDEWALK) return 'SIDEWALK';
    if (atlasLaneType === AtlasLane.LaneType.BUSLANE) return 'BUSLANE';
    if (atlasLaneType === AtlasLane.LaneType.BUS_ONLY) return 'BUS_ONLY';
    if (atlasLaneType === AtlasLane.LaneType.NONE) return 'NONE';
    return 'NONE';
  }, []);

  const addLane = useCallback((laneSide: LaneSide, laneIndex: number, addLaneSide: AddLaneSide) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;

    pScope.addLane(roadId, roadCategory, laneSide, laneIndex, addLaneSide);
  }, [roadItemKeyInfo]);

  const removeLane = useCallback((laneSide: LaneSide, laneId: string) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;

    pScope.removeLane(roadId, roadCategory, laneSide, laneId);
  }, [roadItemKeyInfo]);

  const removeRoad = useCallback(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;

    pScope.removeRoad(roadId, roadCategory);
  }, [roadItemKeyInfo]);

  const transparentRoad = useCallback(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;

    pScope.alterTransparentRoad(roadId, roadCategory, 0);
  }, [roadItemKeyInfo]);

  const deTransparentRoad = useCallback(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;

    pScope.alterTransparentRoad(roadId, roadCategory, 1);
  }, [roadItemKeyInfo]);

  const alterRoadItemAttributeEdit = useCallback((roadItemAttribute: RoadItemAttributeEdit) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;

    pScope.alterRoadItemAttributeEdit(roadId, roadCategory, roadItemAttribute);
  }, [roadItemKeyInfo]);


  return (<Fragment>
    <div id="plugin-road-property-panel-canvas-wrapper" className="plugin-road-property-panel-canvas-wrapper">
      <div className="horizontal-axis">
        {new Array(6).fill(0).map((v: number, idx: number) => {
          return (
            <div key={`h-axis-${idx}`} className="axis-item" style={{ top: `${Math.floor(48 * idx)}px` }}>
              <span>{(altitudeInfo.upperAltitude - (altitudeInfo.upperAltitude - altitudeInfo.lowerAltitude) / 5 * idx).toFixed(1)}</span>
            </div>
          );
        })}
      </div>
      <div className="vertical-axis">
        {new Array(6).fill(0).map((v: number, idx: number) => {
          return (
            <div key={`v-axis-${idx}`} className="axis-item" style={{ left: `${Math.floor(192 * idx)}px` }}>
              <span>{(altitudeDistanceInfo.leftDistance + (altitudeDistanceInfo.rightDistance - altitudeDistanceInfo.leftDistance) / 5 *idx).toFixed(1)}</span>
            </div>
          );
        })}
      </div>
    </div>
    <div className="plugin-road-property-panel-wrapper">
      <div className="road-info">
        <div className="road-property">
          <Row className="road-proerty-margin-bottom">
            <Col span={7} className="road-proerty-text-right">
              <label>id:</label>
            </Col>
            <Col span={17} title={roadItemKeyInfo?.roadId} className="road-proerty-nowrap">
              {roadItemKeyInfo?.roadId}
            </Col>
          </Row>
          <Row className="road-proerty-margin-bottom">
            <Col span={7} className="road-proerty-text-right">
              <label>section:</label>
            </Col>
            <Col span={17} title={roadItemKeyInfo?.roadId} className="road-proerty-nowrap">
              0
            </Col>
          </Row>
          <Row key="junctionId" className="road-proerty-margin-bottom">
            <Col span={7} className="road-proerty-text-right">
              <label>junctionId:</label>
            </Col>
            <Col span={17} title={roadItemKeyInfo?.roadId} className="road-proerty-nowrap">
              {roadItemKeyInfo?.junctionId === undefined ? '无' : roadItemKeyInfo?.junctionId}
            </Col>
          </Row>
          {/* <Row key="nextRoads" className="road-proerty-margin-bottom">
            <Col span={7} className="road-proerty-text-right">
              <label>前序道路:</label>
            </Col>
            <Col span={17}>
              {roadItemKeyInfo?.nextRoads.map((nextRoad: {
                roadId: string;
                roadCategory: RoadCategory;
              }) => {
                return (
                  <Row key={nextRoad.roadId}>
                    <Col span={24} title={nextRoad.roadId} className="road-proerty-text-right road-proerty-nowrap">
                      <label>{nextRoad.roadId}</label>
                    </Col>
                  </Row>
                );
              })}
            </Col>
          </Row>

          <Row key="prevRoads" className="road-proerty-margin-bottom">
            <Col span={7} className="road-proerty-text-right">
              <label>后序道路:</label>
            </Col>
            <Col span={17}>
              {roadItemKeyInfo?.prevRoads.map((prevRoad: {
                roadId: string;
                roadCategory: RoadCategory;
              }) => {
                return (
                  <Row key={prevRoad.roadId}>
                    <Col span={24} title={prevRoad.roadId} className="road-proerty-text-right road-proerty-nowrap">
                      <label>{prevRoad.roadId}</label>
                    </Col>
                  </Row>
                );
              })}
            </Col>
          </Row> */}
          <Form
            labelCol={{ span: 7 }}
            wrapperCol={{ span: 17 }}
            name="road-attribute"
            onValuesChange={alterRoadItemAttributeEdit}
            form={roadItemAttributeForm}
            initialValues={
              {
                atlasRoadType: atlasRoadType
              } as RoadItemAttributeEdit
            }
          >
            <Form.Item name="atlasRoadType" label="道路类型">
              <Select
                options={convertAtlasRoadTypeToArray()}
              >
              </Select>
            </Form.Item>
          </Form>
        </div>
        <div className="road-property-title">左侧车道：</div>
        <div className="road-property-list">
          <div className="road-property-list-item">
            <div key="add-most-left" onClick={() => {
              addLane(LaneSide.Left, -1, AddLaneSide.Left);
            }}>最内侧添加车道</div>
          </div>
          {
            leftLanes.map((laneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
              return (
                <div className="road-property-list-item" key={laneItemKeyInfo.laneId}>
                  <div className="road-property-list-item-col" key={`${laneItemKeyInfo.laneId}-col-1`}>
                    <Row key={laneItemKeyInfo.laneId}>
                      <Col span={24} title={laneItemKeyInfo.laneId} className="road-proerty-nowrap">
                        <label>{`${laneItemKeyInfo.laneId}`}</label>
                      </Col>
                    </Row>
                  </div>

                  <div className="road-property-list-item-col" key={`${laneItemKeyInfo.laneId}-col-3`}>
                    <div key="add-left" onClick={() => {
                      addLane(LaneSide.Left, idx, AddLaneSide.Left);
                    }}>左侧添加车道</div>

                    <div key="add-right" onClick={() => {
                      addLane(LaneSide.Left, idx, AddLaneSide.Right);
                    }}>右侧添加车道</div>

                    <div key="remove" onClick={() => {
                      removeLane(LaneSide.Left, laneItemKeyInfo.laneId);
                    }}>删除车道</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div className="road-property-title">右侧车道：</div>
        <div className="road-property-list">
          <div className="road-property-list-item">
            <div key="add-most-left" onClick={() => {
              addLane(LaneSide.Right, -1, AddLaneSide.Left);
            }}>最内侧添加车道</div>
          </div>
          
          {
            rightLanes.map((laneItemKeyInfo: LaneItemKeyInfo, idx: number) => {
              return (
                <div className="road-property-list-item" key={laneItemKeyInfo.laneId}>
                  <div className="road-property-list-item-col" key={`${laneItemKeyInfo.laneId}-col-1`}>
                    <Row key={laneItemKeyInfo.laneId}>
                      <Col span={24} title={laneItemKeyInfo.laneId} className="road-proerty-nowrap">
                        <label>{`${laneItemKeyInfo.laneId}`}</label>
                      </Col>
                    </Row>
                  </div>

                  <div className="road-property-list-item-col" key={`${laneItemKeyInfo.laneId}-col-3`}>
                    <div key="add-left" onClick={() => {
                      addLane(LaneSide.Right, idx, AddLaneSide.Left);
                    }}>左侧添加车道</div>

                    <div key="add-right" onClick={() => {
                      addLane(LaneSide.Right, idx, AddLaneSide.Right);
                    }}>右侧添加车道</div>

                    <div key="remove" onClick={() => {
                      removeLane(LaneSide.Right, laneItemKeyInfo.laneId);
                    }}>删除车道</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div className="road-operation">
          <div key="remove" className="action" onClick={() => {
            removeRoad();
          }}>删除道路</div>
        </div>
      </div>
    </div>
  </Fragment>);
}

export default RoadPropertyPanel;