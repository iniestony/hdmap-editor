import {
  Vector3,
  Color3,
  LinesMesh,
  Mesh,
} from "@babylonjs/core";
import { useState, useCallback, useEffect } from "react";
import { Form, Select, Row, Col } from 'antd';
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
import {
  EnterEditingJunctionItemEvent,
  ExitEditingJunctionItemEvent,
} from '../../../../core/plugins/junctionEditor/constant';
import {
  JunctionItemAttributeEdit
} from '../../../../core/plugins/junctionEditor/type';
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
  AtlasJunction
} from '../../../../core/plugins/atlasConverter/type';
import {
  TriggerDecorateNewRoadPrevAndNextConnectionRoadVertexEvent,
} from '../../../../core/plugins/junctionEditor/constant';
import './index.scss';


function JunctionPropertyPanel(props: RenderedFuncCompProps) {
  const [junctionItemKeyInfo, setJunctionItemKeyInfo] = useState<JunctionItemKeyInfo | null>(null);
  const [junctionType, setJunctionType] = useState<AtlasJunction.Type>(AtlasJunction.Type.CROSS_ROAD);
  const [junctionItemAttributeForm] = Form.useForm();
  const [involvedRoads, setInvolvedRoads] = useState<Array<{
    roadId: string;
    roadCategory: RoadCategory;
  }>>([]);

  useEffect(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    pScope.onEvent(EnterEditingJunctionItemEvent, (params: { payload: Object | string | number | null }) => {
      const junctionItem = (params.payload as { junctionItem: JunctionItem }).junctionItem;
      const junctionItemKeyInfo = pScope.resolveJunctionItemKeyInfo(junctionItem) as JunctionItemKeyInfo;

      syncJunctionProperty(junctionItemKeyInfo);
    });
  }, []);

  const syncJunctionProperty = useCallback((junctionItemKeyInfo: JunctionItemKeyInfo) => {
    setJunctionItemKeyInfo(junctionItemKeyInfo);

    setInvolvedRoads(junctionItemKeyInfo.involvedRoads);
    setJunctionType(junctionItemKeyInfo.junctionType);

    junctionItemAttributeForm.setFieldsValue({
      junctionType: junctionItemKeyInfo.junctionType
    } as JunctionItemAttributeEdit);
  }, []);

  const convertJunctionTypeToArray = useCallback(() => {
    const junctionTypeToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasJunction.Type).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasJunction.Type[key]
        };
        junctionTypeToArray.push(data);
      };
    });
    return junctionTypeToArray;
  }, []);

  const removeJunction = useCallback(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const j = junctionItemKeyInfo as JunctionItemKeyInfo;
    const junctionId = j.junctionId;

    pScope.removeJunction(junctionId);
  }, [junctionItemKeyInfo]);

  const alterJunctionItemAttributeEdit = useCallback((junctionItemAttribute: JunctionItemAttributeEdit) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const j = junctionItemKeyInfo as JunctionItemKeyInfo;
    const junctionId = j.junctionId;

    pScope.alterJunctionItemAttributeEdit(junctionId, junctionItemAttribute);
  }, [junctionItemKeyInfo]);

  const enterEditRoadConnection = useCallback((road: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const roadItem = pScope.resolveRoadByRoadIdAndRoadCategory(road.roadId, road.roadCategory) as RoadItem;

    pScope.exitEditJunction();
    pScope.enterEditRoadConnection(roadItem);
  }, [props.pScope]);

  const removeRoadConnection = useCallback((road: {
    roadId: string;
    roadCategory: RoadCategory;
  }) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const roadItem = pScope.resolveRoadByRoadIdAndRoadCategory(road.roadId, road.roadCategory) as RoadItem;

    pScope.removeRoadConnection(roadItem.roadId, roadItem.category);
  }, [props.pScope]);

  const triggerAddConnectionRoad = useCallback(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    const j = junctionItemKeyInfo as JunctionItemKeyInfo;
    const junctionId = j.junctionId;

    pScope.emitEvent(TriggerDecorateNewRoadPrevAndNextConnectionRoadVertexEvent, { junctionId });
  }, [junctionItemKeyInfo]);

  return (
    <div className="plugin-junction-property-panel-wrapper">
      <div className="road-info">
        <div className="road-junction-property">
          <Row className="junction-proerty-margin-bottom">
            <Col span={7} className="junction-proerty-text-right">
              <label>id:</label>
            </Col>
            <Col span={17} title={junctionItemKeyInfo?.junctionId} className="junction-proerty-nowrap">
              {junctionItemKeyInfo?.junctionId}
            </Col>
          </Row>
          <Form
            labelCol={{ span: 7 }}
            wrapperCol={{ span: 17 }}
            name="road-attribute-junction"
            onValuesChange={alterJunctionItemAttributeEdit}
            form={junctionItemAttributeForm}
            initialValues={{
              junctionType: junctionType
            } as JunctionItemAttributeEdit}
          >
            <Form.Item name="junctionType" label="路口类型">
              <Select
                options={convertJunctionTypeToArray()}
              >
              </Select>
            </Form.Item>
          </Form>
        </div>
        <div className="road-property-title">道路连接列表</div>
        <div className="road-property-list">
          <div className="road-property-list-item">
            <div key="add-road" onClick={() => {
              triggerAddConnectionRoad();
            }}>添加道路连接</div>
          </div>
          {
            involvedRoads.map((road: {
              roadId: string;
              roadCategory: RoadCategory;
            }, idx: number) => {
              return (
                <div className="road-property-list-item" key={road.roadId}>
                  <div className="road-property-list-item-col sm" key={`${road.roadId}-col-1`}>
                    <div>{road.roadId}</div>

                    <div key="enterEditRoadConnection" onClick={() => {
                      enterEditRoadConnection(road);
                    }}>编辑道路连接</div>
                    
                    <div key="removeRoadConnection" onClick={() => {
                      removeRoadConnection(road);
                    }}>删除道路连接</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div className="road-operation">
          <div key="remove" className="action" onClick={() => {
            removeJunction();
          }}>删除路口</div>
        </div>
      </div>
    </div>
  );
}

export default JunctionPropertyPanel;