import { useState, useCallback, useEffect, useMemo, Fragment } from "react";
import { Form, Select, Row, Col, InputNumber, Space } from 'antd';
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
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
  JunctionItem,
  JunctionEdgeItem,
  JunctionItemKeyInfo,
  JunctionEdgeItemKeyInfo,
} from '../../../../core/plugins/statusManager/type';
import {
  EnterEditingRoadLaneItemEvent
} from '../../../../core/plugins/roadLaneEditor/constant'
import {
  RoadLaneAttributeEdit,
  RoadLaneLineAttributeEdit,
  RoadLaneLinesAttributeFormEdit
} from '../../../../core/plugins/roadLaneEditor/type';
import {
  UpdateRoadLaneAltitudeAxisEvent,
} from '../../../../core/plugins/roadLaneAltitudeAdaptor/constant';
import {
  AtlasLaneBoundaryType,
  AtlasLane,
} from '../../../../core/plugins/atlasConverter/type';
import RendererConfig from '../../../../core/renderer/config';
import './index.scss';

function RoadLanePropertyPanel(props: RenderedFuncCompProps) {
  const [laneItemKeyInfo, setLaneItemKeyInfo] = useState<LaneItemKeyInfo | null>(null);
  const [roadItemKeyInfo, setRoadItemKeyInfo] = useState<RoadItemKeyInfo | null>(null);
  const [roadLaneItemAttributeForm] = Form.useForm();
  const [atlasLaneSpeedLimit, setAtlasLaneSpeedLimit] = useState<number>(0);
  const [atlasLaneType, setAtlasLaneType] = useState<AtlasLane.LaneType>(RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneType);
  const [atlasLaneTurn, setAtlasLaneTurn] = useState<AtlasLane.LaneTurn>(RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneTurn);
  const [atlasLaneDirection, setAtlasLaneDirection] = useState<AtlasLane.LaneDirection>(RendererConfig.laneAttrDefaultValue.roadLane.atlasLaneDirection);
  const [laneLines_innerLaneLine_atlasLaneBoundaryVirtual, setLaneLines_innerLaneLine_atlasLaneBoundaryVirtual] = useState<boolean>(RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual);
  const [laneLines_innerLaneLine_atlasLaneBoundaryType, setLaneLines_innerLaneLine_atlasLaneBoundaryType] = useState<AtlasLaneBoundaryType.Type>(RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType);
  const [laneLines_outerLaneLine_atlasLaneBoundaryVirtual, setLaneLines_outerLaneLine_atlasLaneBoundaryVirtual] = useState<boolean>(RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryVirtual);
  const [laneLines_outerLaneLine_atlasLaneBoundaryType, setLaneLines_outerLaneLine_atlasLaneBoundaryType] = useState<AtlasLaneBoundaryType.Type>(RendererConfig.laneAttrDefaultValue.roadLaneLine.atlasLaneBoundaryType);

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
    pScope.onEvent(EnterEditingRoadLaneItemEvent, (params: { payload: Object | string | number | null }) => {
      const laneItem = (params.payload as { laneItem: LaneItem }).laneItem;
      const roadItem = (params.payload as { roadItem: RoadItem }).roadItem;

      const roadItemKeyInfo = pScope.resolveRoadItemKeyInfo(roadItem) as RoadItemKeyInfo;
      const laneItemKeyInfo = pScope.resolveLaneByLaneRoadIdAndRoadCategory(laneItem.laneId, roadItem.roadId, roadItem.category);

      syncLaneProperty(laneItemKeyInfo);
      syncRoadProperty(roadItemKeyInfo);
    });

    pScope.onEvent(UpdateRoadLaneAltitudeAxisEvent, (params: { payload: Object | string | number | null }) => {
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
  }, []);

  const syncLaneProperty = useCallback((laneItemKeyInfo: LaneItemKeyInfo) => {
    setLaneItemKeyInfo(laneItemKeyInfo);
    setAtlasLaneSpeedLimit(laneItemKeyInfo.atlasLaneSpeedLimit);
    setAtlasLaneType(laneItemKeyInfo.atlasLaneType);
    setAtlasLaneTurn(laneItemKeyInfo.atlasLaneTurn);
    setAtlasLaneDirection(laneItemKeyInfo.atlasLaneDirection);

    setLaneLines_innerLaneLine_atlasLaneBoundaryVirtual(laneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual);
    setLaneLines_innerLaneLine_atlasLaneBoundaryType(laneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType);
    setLaneLines_outerLaneLine_atlasLaneBoundaryVirtual(laneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual);
    setLaneLines_outerLaneLine_atlasLaneBoundaryType(laneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType);

    roadLaneItemAttributeForm.setFieldsValue({
      atlasLaneSpeedLimit: laneItemKeyInfo.atlasLaneSpeedLimit,
      atlasLaneType: laneItemKeyInfo.atlasLaneType,
      atlasLaneTurn: laneItemKeyInfo.atlasLaneTurn,
      atlasLaneDirection: laneItemKeyInfo.atlasLaneDirection,
      laneLines_innerLaneLine_atlasLaneBoundaryVirtual: laneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryVirtual,
      laneLines_innerLaneLine_atlasLaneBoundaryType: laneItemKeyInfo.laneLines.innerLaneLine.atlasLaneBoundaryType,
      laneLines_outerLaneLine_atlasLaneBoundaryVirtual: laneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryVirtual,
      laneLines_outerLaneLine_atlasLaneBoundaryType: laneItemKeyInfo.laneLines.outerLaneLine.atlasLaneBoundaryType,
    } as RoadLaneAttributeEdit);
  }, []);

  const convertAtlasLaneBoundaryTypeInnerToArray = useCallback(() => {
    const atlasLaneBoundaryTypeInnerToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasLaneBoundaryType.Type).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        let data = {
          value: key,
          label: AtlasLaneBoundaryType.Type[key],
          disabled: false
        };

        if (laneLines_innerLaneLine_atlasLaneBoundaryVirtual && key !== AtlasLaneBoundaryType.Type.UNKNOWN) {
          data.disabled = true;
        }

        atlasLaneBoundaryTypeInnerToArray.push(data);
      };
    });
    return atlasLaneBoundaryTypeInnerToArray;
  }, [laneLines_innerLaneLine_atlasLaneBoundaryVirtual]);

  const convertAtlasLaneBoundaryTypeOuterToArray = useCallback(() => {
    const atlasLaneBoundaryTypeOuterToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasLaneBoundaryType.Type).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        let data = {
          value: key,
          label: AtlasLaneBoundaryType.Type[key],
          disabled: false
        };

        if (laneLines_outerLaneLine_atlasLaneBoundaryVirtual && key !== AtlasLaneBoundaryType.Type.UNKNOWN) {
          data.disabled = true;
        }
        atlasLaneBoundaryTypeOuterToArray.push(data);
      };
    });
    return atlasLaneBoundaryTypeOuterToArray;
  }, [laneLines_outerLaneLine_atlasLaneBoundaryVirtual]);

  const convertAtlasLaneTypeToArray = useCallback(() => {
    const atlasLaneTypeToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasLane.LaneType).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasLane.LaneType[key],
        };
        atlasLaneTypeToArray.push(data);
      };
    });
    return atlasLaneTypeToArray;
  }, []);

  const convertAtlasLaneTurnToArray = useCallback(() => {
    const atlasLaneTurnToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasLane.LaneTurn).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasLane.LaneTurn[key],
        };
        atlasLaneTurnToArray.push(data);
      };
    });
    return atlasLaneTurnToArray;
  }, []);

  const convertAtlasLaneDirectionToArray = useCallback(() => {
    const atlasLaneDirectionToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasLane.LaneDirection).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasLane.LaneDirection[key],
        };
        atlasLaneDirectionToArray.push(data);
      };
    });
    return atlasLaneDirectionToArray;
  }, []);

  const convertLaneSideType = useCallback((laneSide?: LaneSide) => {
    if (laneSide === LaneSide.Left) return 'Left';
    if (laneSide === LaneSide.Right) return 'Right';
    return 'NONE';
  }, []);

  const alterRoadLaneItemAttributeEdit = useCallback((roadLaneAttributeEdit: RoadLaneAttributeEdit | RoadLaneLinesAttributeFormEdit) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const l = laneItemKeyInfo as LaneItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;
    const landId = l.laneId;

    let roadLaneLineAttributeEdit = {} as RoadLaneLineAttributeEdit;
    let keySwitch = null;

    for (let key in roadLaneAttributeEdit) {
      if (key === 'laneLines_innerLaneLine_atlasLaneBoundaryVirtual' || key === 'laneLines_innerLaneLine_atlasLaneBoundaryType') {
        keySwitch = 'laneLines_innerLaneLine';
        roadLaneLineAttributeEdit = convertRoadLaneLinesAttributeToObject('laneLines_innerLaneLine_', roadLaneAttributeEdit)
      } else if (key === 'laneLines_outerLaneLine_atlasLaneBoundaryVirtual' || key === 'laneLines_outerLaneLine_atlasLaneBoundaryType') {
        keySwitch = 'laneLines_outerLaneLine';
        roadLaneLineAttributeEdit = convertRoadLaneLinesAttributeToObject('laneLines_outerLaneLine_', roadLaneAttributeEdit)
      } else {
        keySwitch = 'roadLane';
      };
    };

    if (keySwitch === 'roadLane') {
      pScope.alterRoadLaneItemAttributeEdit(landId, roadId, roadCategory, roadLaneAttributeEdit);
    } else if (keySwitch === 'laneLines_innerLaneLine') {
      if (roadLaneLineAttributeEdit.atlasLaneBoundaryType !== undefined || roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual !== undefined) {
        if (roadLaneLineAttributeEdit.atlasLaneBoundaryType === undefined) {
          roadLaneLineAttributeEdit.atlasLaneBoundaryType = l.laneLines.innerLaneLine.atlasLaneBoundaryType;
        } else if (roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual === undefined) {
          roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual = l.laneLines.innerLaneLine.atlasLaneBoundaryVirtual;
        }

        if (roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual) {
          roadLaneLineAttributeEdit.atlasLaneBoundaryType = AtlasLaneBoundaryType.Type.UNKNOWN;
        }
        
        pScope.alterRoadLaneLineItemLaneBoundaryTypeEdit(landId, roadId, roadCategory, roadLaneLineAttributeEdit.atlasLaneBoundaryType, roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual, LaneLineSide.Inner);
      } else {
        pScope.alterRoadLaneLineItemAttributeEdit(landId, roadId, roadCategory, roadLaneLineAttributeEdit, LaneLineSide.Inner);
      }
    } else if (keySwitch === 'laneLines_outerLaneLine') {
      if (roadLaneLineAttributeEdit.atlasLaneBoundaryType !== undefined || roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual !== undefined) {
        if (roadLaneLineAttributeEdit.atlasLaneBoundaryType === undefined) {
          roadLaneLineAttributeEdit.atlasLaneBoundaryType = l.laneLines.outerLaneLine.atlasLaneBoundaryType;
        } else if (roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual === undefined) {
          roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual = l.laneLines.outerLaneLine.atlasLaneBoundaryVirtual;
        }

        if (roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual) {
          roadLaneLineAttributeEdit.atlasLaneBoundaryType = AtlasLaneBoundaryType.Type.UNKNOWN;
        }

        pScope.alterRoadLaneLineItemLaneBoundaryTypeEdit(landId, roadId, roadCategory, roadLaneLineAttributeEdit.atlasLaneBoundaryType, roadLaneLineAttributeEdit.atlasLaneBoundaryVirtual, LaneLineSide.Outer);
      } else {
        pScope.alterRoadLaneLineItemAttributeEdit(landId, roadId, roadCategory, roadLaneLineAttributeEdit, LaneLineSide.Outer);
      }
    };

  }, [laneItemKeyInfo]);

  const convertRoadLaneLinesAttributeToObject = useCallback((replaceType: string, RoadLaneLinesAttributeFormEdit: RoadLaneAttributeEdit | RoadLaneLinesAttributeFormEdit) => {
    const roadLaneLineAttributeEdit = {} as RoadLaneLineAttributeEdit;

    for (let n in RoadLaneLinesAttributeFormEdit) {
      const key = n as keyof typeof RoadLaneLinesAttributeFormEdit;
      const newKey = n.replace(replaceType, '') as keyof typeof RoadLaneLinesAttributeFormEdit;
      roadLaneLineAttributeEdit[newKey] = RoadLaneLinesAttributeFormEdit[key];
    }

    return roadLaneLineAttributeEdit;
  }, []);

  const removeRoadLine = useCallback((laneSide?: LaneSide, laneId?: string) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const r = roadItemKeyInfo as RoadItemKeyInfo;
    const roadId = r.roadId;
    const roadCategory = r.category;
    pScope.removeLane(roadId, roadCategory, laneSide, laneId);
  }, [laneItemKeyInfo]);

  const neighborForwardIdUi = useMemo(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const forwardId = pScope.resolveNeighborForwardId(roadItemKeyInfo, laneItemKeyInfo)
    if (!forwardId) return;
    return (
      <>
        <Row key="left_neighbor_forward_lane_id" className="lane-property-margin-bottom">
          <Col span={18} className="lane-property-text-right">
            <label>left_neighbor_forward_lane_id:</label>
          </Col>
          <Col span={4} title={forwardId.leftNeighborForwardLaneId} className="lane-property-nowrap">
            {forwardId.leftNeighborForwardLaneId}
          </Col>
        </Row>
        <Row key="right_neighbor_forward_lane_id" className="lane-property-margin-bottom">
          <Col span={18} className="lane-property-text-right">
            <label>right_neighbor_forward_lane_id:</label>
          </Col>
          <Col span={4} title={forwardId.rightNeighborForwardLaneId} className="lane-property-nowrap">
            {forwardId.rightNeighborForwardLaneId}
          </Col>
        </Row>
      </>
    )
  }, [roadItemKeyInfo, laneItemKeyInfo])

  const neighborReversedUi = useMemo(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const reverseId = pScope.resolveNeighborReverseId(roadItemKeyInfo, laneItemKeyInfo)
    if (!reverseId) return;
    return (
      <>
        <Row key="left_neighbor_forward_lane_id" className="lane-property-margin-bottom">
          <Col span={18} className="lane-property-text-right">
            <label>left_neighbor_reverse_lane_id:</label>
          </Col>
          <Col span={4} title={reverseId.leftNeighborReverseLaneId} className="lane-property-nowrap">
            {reverseId.leftNeighborReverseLaneId}
          </Col>
        </Row>
        <Row key="right_neighbor_forward_lane_id" className="lane-property-margin-bottom">
          <Col span={18} className="lane-property-text-right">
            <label>right_neighbor_reverse_lane_id:</label>
          </Col>
          <Col span={4} title={reverseId.rightNeighborReverseLaneId} className="lane-property-nowrap">
            {reverseId.rightNeighborReverseLaneId}
          </Col>
        </Row>
      </>
    )
  }, [roadItemKeyInfo, laneItemKeyInfo])

  return (<Fragment>
    <div id="plugin-road-lane-property-panel-canvas-wrapper" className="plugin-road-lane-property-panel-canvas-wrapper">
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
    <div className="plugin-lane-property-panel-wrapper">
      <div className="road-info">
        <div className="road-lane-property">
          <Form
            labelCol={{ span: 8 }}
            wrapperCol={{ span: 16 }}
            name="road-lane-attribute"
            onValuesChange={alterRoadLaneItemAttributeEdit}
            form={roadLaneItemAttributeForm}
            initialValues={
              {
                atlasLaneSpeedLimit: atlasLaneSpeedLimit,
                atlasLaneType: atlasLaneType,
                atlasLaneTurn: atlasLaneTurn,
                atlasLaneDirection: atlasLaneDirection,
                laneLines_innerLaneLine_atlasLaneBoundaryVirtual: laneLines_innerLaneLine_atlasLaneBoundaryVirtual,
                laneLines_innerLaneLine_atlasLaneBoundaryType: laneLines_innerLaneLine_atlasLaneBoundaryType,
                laneLines_outerLaneLine_atlasLaneBoundaryVirtual: laneLines_outerLaneLine_atlasLaneBoundaryVirtual,
                laneLines_outerLaneLine_atlasLaneBoundaryType: laneLines_outerLaneLine_atlasLaneBoundaryType,
              } as RoadLaneAttributeEdit | RoadLaneLinesAttributeFormEdit
            }
          >
            <Row className="lane-property-margin-bottom">
              <Col span={8} className="lane-property-text-right">
                <label>id:</label>
              </Col>
              <Col span={16} title={laneItemKeyInfo?.laneId} className="lane-property-nowrap">
                {laneItemKeyInfo?.laneId}
              </Col>
            </Row>
            <Row className="lane-property-margin-bottom">
              <Col span={8} className="lane-property-text-right">
                <label>section:</label>
              </Col>
              <Col span={16} title={laneItemKeyInfo?.laneId} className="lane-property-nowrap">
                0
              </Col>
            </Row>
            <Row key="junctionId" className="lane-property-margin-bottom">
              <Col span={8} className="lane-property-text-right">
                <label>junctionId:</label>
              </Col>
              <Col span={16} title={laneItemKeyInfo?.laneId} className="lane-property-nowrap">
                {roadItemKeyInfo?.junctionId === undefined ? '无' : roadItemKeyInfo?.junctionId}
              </Col>
            </Row>
            <Row key="prevLanes" className="lane-property-margin-bottom">
              <Col span={9} className="lane-property-text-right">
                <label>predecessor_id:</label>
              </Col>
              <Col span={15}>
                {laneItemKeyInfo?.prevLanes.map((prevLane: {
                  laneId: string;
                  roadId: string;
                  roadCategory: RoadCategory;
                }) => {
                  return (
                    <Row key={prevLane.laneId}>
                      <Col span={24} title={prevLane.laneId} className="lane-property-nowrap">
                        <label>{prevLane.laneId}</label>
                      </Col>
                    </Row>
                  );
                })}
              </Col>
            </Row>
            <Row key="nextLanes" className="lane-property-margin-bottom">
              <Col span={9} className="lane-property-text-right">
                <label>successor_id:</label>
              </Col>
              <Col span={15}>
                {laneItemKeyInfo?.nextLanes.map((nextLane: {
                  laneId: string;
                  roadId: string;
                  roadCategory: RoadCategory;
                }) => {
                  return (
                    <Row key={nextLane.laneId}>
                      <Col span={24} title={nextLane.laneId} className="lane-property-nowrap">
                        <label>{nextLane.laneId}</label>
                      </Col>
                    </Row>
                  );
                })}
              </Col>
            </Row>
            {neighborForwardIdUi}
            {neighborReversedUi}
            <Row className="lane-property-margin-bottom" style={{ marginBottom: "10px" }}>
              <Col span={8} className="lane-property-text-right" >
                <label>left_boundary:</label>
              </Col>
            </Row>
            <Form.Item name="laneLines_innerLaneLine_atlasLaneBoundaryVirtual" label="virtual" style={{ marginBottom: "15px" }}>
              <Select
                options={[
                  { value: true, label: 'true' },
                  { value: false, label: 'false' },
                ]}
              />
            </Form.Item>
            <Form.Item name="laneLines_innerLaneLine_atlasLaneBoundaryType" label="type"  >
              <Select
                options={convertAtlasLaneBoundaryTypeInnerToArray()}
              />
            </Form.Item>
            <Row className="lane-property-margin-bottom" style={{ marginBottom: "10px" }}>
              <Col span={8} className="lane-property-text-right" >
                <label>right_boundary:</label>
              </Col>
            </Row>
            <Form.Item name="laneLines_outerLaneLine_atlasLaneBoundaryVirtual" label="virtual" style={{ marginBottom: "15px" }}>
              <Select
                options={[
                  { value: true, label: 'true' },
                  { value: false, label: 'false' },
                ]}
              />
            </Form.Item>
            <Form.Item name="laneLines_outerLaneLine_atlasLaneBoundaryType" label="type">
              <Select
                options={convertAtlasLaneBoundaryTypeOuterToArray()}
              />
            </Form.Item>
            <Row className="lane-property-margin-bottom">
              <Col span={8} className="lane-property-text-right">
                <label>length:</label>
              </Col>
              <Col span={16} className="lane-property-nowrap">
                无
              </Col>
            </Row>
            <Form.Item className="speed" label="speed_limit">
              <Space align="start">
                <Form.Item name="atlasLaneSpeedLimit">
                  <InputNumber />
                </Form.Item>
                <span className="km">km/h</span>
              </Space>
            </Form.Item>
            <Form.Item name="atlasLaneType" label="type">
              <Select
                options={convertAtlasLaneTypeToArray()}
              />
            </Form.Item>
            <Form.Item name="atlasLaneTurn" label="Turn">
              <Select
                options={convertAtlasLaneTurnToArray()}
              />
            </Form.Item>
            <Form.Item name="atlasLaneDirection" label="direction">
              <Select
                options={convertAtlasLaneDirectionToArray()}
              />
            </Form.Item>
          </Form>
          <div className="road-lane-operation">
            <div className="action" key="remove" onClick={() => {
              removeRoadLine(laneItemKeyInfo?.laneSide, laneItemKeyInfo?.laneId);
            }}>删除车道
            </div>
          </div>
        </div>
      </div>
    </div>
  </Fragment>);
}
export default RoadLanePropertyPanel;