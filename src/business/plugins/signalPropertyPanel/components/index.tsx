import {
  Vector3,
} from '@babylonjs/core';
import { useState, useCallback, useEffect, Fragment } from "react";
import { Form, Row, Select, Col, Slider, Button } from 'antd';
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
import {
  EnterEditingSignalItemEvent,
} from '../../../../core/plugins/signalEditor/constant';
import {
  SignalItemAttributeEdit
} from '../../../../core/plugins/signalEditor/type';
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
  SignalItem,
  SignalItemKeyInfo,
  SubSignalItem,
  SubSignalItemKeyInfo,
} from '../../../../core/plugins/statusManager/type';
import {
  AtlasSignal,
  AtlasSubsignal,
} from '../../../../core/plugins/atlasConverter/type';
import './index.scss';

function SignalPropertyPanel(props: RenderedFuncCompProps) {
  const [signalItemKeyInfo, setSignalItemKeyInfo] = useState<SignalItemKeyInfo | null>(null);

  const [signalItemAttributeForm] = Form.useForm();
  const [signalType, setSignalType] = useState<AtlasSignal.Type>(AtlasSignal.Type.UNKNOWN);

  const [signalWidth, setSignalWidth] = useState<number>(0);
  const [signalHeight, setSignalHeight] = useState<number>(0);
  const [signalRotationHorizontal, setSignalRotationHorizontal] = useState<number>(0);
  const [signalRotationVertical, setSignalRotationVertical] = useState<number>(0);
  

  useEffect(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    pScope.onEvent(EnterEditingSignalItemEvent, (params: { payload: Object | string | number | null }) => {
      const signalItem = (params.payload as { signalItem: SignalItem }).signalItem;
      const signalItemKeyInfo = pScope.resolveSignalItemKeyInfo(signalItem) as SignalItemKeyInfo;

      syncSignalProperty(signalItemKeyInfo);
    });
  }, []);

  const syncSignalProperty = useCallback((signalItemKeyInfo: SignalItemKeyInfo) => {
    setSignalItemKeyInfo(signalItemKeyInfo);

    signalItemAttributeForm.setFieldsValue({
      signalType: signalItemKeyInfo.signalType,
    } as SignalItemAttributeEdit);
    setSignalType(signalItemKeyInfo.signalType);

    setSignalWidth(signalItemKeyInfo.width);
    setSignalHeight(signalItemKeyInfo.height);
    setSignalRotationHorizontal(signalItemKeyInfo.rotationHorizontal);
    setSignalRotationVertical(signalItemKeyInfo.rotationVertical);
  }, []);

  const convertAtlasSignalTypeToArray = useCallback(() => {
    const atlasSignalTypeToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasSignal.Type).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasSignal.Type[key],
        };
        atlasSignalTypeToArray.push(data);
      };
    });
    return atlasSignalTypeToArray;
  }, []);

  const convertAtlasSubSignalTypeToArray = useCallback(() => {
    const atlasSubSignalTypeToArray: { value: number, label: string }[] = [];

    Object.keys(AtlasSubsignal.Type).map((obj) => {
      const regPos = /^(0|[1-9][0-9]*|-[1-9][0-9]*)$/;
      if (regPos.test(obj)) {
        const key: number = parseInt(obj);
        const data = {
          value: key,
          label: AtlasSubsignal.Type[key],
        };
        atlasSubSignalTypeToArray.push(data);
      };
    });
    return atlasSubSignalTypeToArray;
  }, []);

  const alterSignalItemAttributeEdit = useCallback((signalItemAttributeEdit: SignalItemAttributeEdit) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const s = signalItemKeyInfo as SignalItemKeyInfo;

    pScope.alterSignalItemAttributeEdit(s.signalId, signalItemAttributeEdit);
  }, [signalItemKeyInfo]);

  const alterSignalWidth = useCallback(
    (width: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;
      const s = signalItemKeyInfo as SignalItemKeyInfo;

      setSignalWidth(width);

      pScope.alterSignalGeometry(s.signalId, { width });
    },
    [signalItemKeyInfo]
  );

  const alterSignalHeight = useCallback(
    (height: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;
      const s = signalItemKeyInfo as SignalItemKeyInfo;

      setSignalHeight(height);

      pScope.alterSignalGeometry(s.signalId, { height });
    },
    [signalItemKeyInfo]
  );

  const alterSignalRotationHorizontal = useCallback(
    (rotationHorizontal: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;
      const s = signalItemKeyInfo as SignalItemKeyInfo;

      setSignalRotationHorizontal(rotationHorizontal);

      pScope.alterSignalGeometry(s.signalId, { rotationHorizontal });
    },
    [signalItemKeyInfo]
  );

  const alterSignalRotationVertical = useCallback(
    (rotationVertical: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;
      const s = signalItemKeyInfo as SignalItemKeyInfo;

      setSignalRotationVertical(rotationVertical);

      pScope.alterSignalGeometry(s.signalId, { rotationVertical });
    },
    [signalItemKeyInfo]
  );

  const alterSignalPosition = useCallback(
    (axis: string, v: number) => {
      const pScope = props.pScope as unknown as ExtendedNamespace;
      const s = signalItemKeyInfo as SignalItemKeyInfo;

      const oldPosition = s.position;

      pScope.alterSignalGeometry(s.signalId, { position: new Vector3(
        oldPosition.x + (axis === 'x' ? v : 0),
        oldPosition.y + (axis === 'y' ? v : 0),
        oldPosition.z + (axis === 'z' ? v : 0),
      ) });
    },
    [signalItemKeyInfo]
  );

  const alterSubSignalType = useCallback((subSignalId: string, type: number) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const s = signalItemKeyInfo as SignalItemKeyInfo;

    pScope.alterSubSignalType(s.signalId, subSignalId, type);
  }, [signalItemKeyInfo]);
  
  const removeSignal = useCallback(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const s = signalItemKeyInfo as SignalItemKeyInfo;

    pScope.removeSignal(s.signalId);
  }, [signalItemKeyInfo]);



  return (
    <div className="plugin-signal-property-panel-wrapper">
      <div className="signal-info">
        <div className="signal-property">
          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>红绿灯板ID:</label>
            </Col>
            <Col span={17} title={signalItemKeyInfo?.signalId} className="signal-property-nowrap">
              {signalItemKeyInfo?.signalId}
            </Col>
          </Row>
          
          <Form
            labelCol={{ span: 7 }}
            wrapperCol={{ span: 17 }}
            name="signal-attribute"
            onValuesChange={alterSignalItemAttributeEdit}
            form={signalItemAttributeForm}
            initialValues={
              {
                signalType: signalType,
              } as SignalItemAttributeEdit
            }
          >
            <Form.Item name="signalType" label="红绿灯类型">
              <Select
                options={convertAtlasSignalTypeToArray()}
              >
              </Select>
            </Form.Item>
          </Form>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>灯板宽度:</label>
            </Col>
            <Col span={17}>
              <Slider
                min={0.01}
                max={5}
                step={0.01}
                value={signalWidth}
                tooltip={{
                  formatter: (v: number | undefined) => {
                    return v !== undefined ? v.toFixed(2) : '';
                  }
                }}
                onChange={(v: number) => {
                  alterSignalWidth(v);
                }}
              />
            </Col>
          </Row>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>灯板高度:</label>
            </Col>
            <Col span={17}>
              <Slider
                min={0.01}
                max={5}
                step={0.01}
                value={signalHeight}
                tooltip={{
                  formatter: (v: number | undefined) => {
                    return v !== undefined ? v.toFixed(2) : '';
                  }
                }}
                onChange={(v: number) => {
                  alterSignalHeight(v);
                }}
              />
            </Col>
          </Row>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>横轴旋转:</label>
            </Col>
            <Col span={17}>
              <Slider
                min={-Math.PI / 2}
                max={Math.PI / 2}
                step={0.01}
                value={signalRotationHorizontal}
                tooltip={{
                  formatter: (v: number | undefined) => {
                    return v !== undefined ? v.toFixed(2) : '';
                  }
                }}
                onChange={(v: number) => {
                  alterSignalRotationHorizontal(v);
                }}
              />
            </Col>
          </Row>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>纵轴旋转:</label>
            </Col>
            <Col span={17}>
              <Slider
                min={-Math.PI / 2}
                max={Math.PI / 2}
                step={0.01}
                value={signalRotationVertical}
                tooltip={{
                  formatter: (v: number | undefined) => {
                    return v !== undefined ? v.toFixed(2) : '';
                  }
                }}
                onChange={(v: number) => {
                  alterSignalRotationVertical(v);
                }}
              />
            </Col>
          </Row>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>左右位移:</label>
            </Col>
            <Col span={17}>
              <Button className="signal-property-pos-btn" onClick={() => {
                alterSignalPosition('x', -0.1);
              }}>左移1分米</Button>
              <Button className="signal-property-pos-btn" onClick={() => {
                alterSignalPosition('x', 0.1);
              }}>右移1分米</Button>
            </Col>
          </Row>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>上下位移:</label>
            </Col>
            <Col span={17}>
              <Button className="signal-property-pos-btn" onClick={() => {
                alterSignalPosition('y', 0.1);
              }}>上移1分米</Button>
              <Button className="signal-property-pos-btn" onClick={() => {
                alterSignalPosition('y', -0.1);
              }}>下移1分米</Button>
            </Col>
          </Row>

          <Row className="signal-property-margin-bottom">
            <Col span={7} className="signal-property-text-right">
              <label>前后位移:</label>
            </Col>
            <Col span={17}>
              <Button className="signal-property-pos-btn" onClick={() => {
                alterSignalPosition('z', -0.1);
              }}>前移1分米</Button>
              <Button className="signal-property-pos-btn" onClick={() => {
                alterSignalPosition('z', 0.1);
              }}>后移1分米</Button>
            </Col>
          </Row>
        </div>

        <div className="signal-property-title">红绿灯泡：</div>
        <div className="signal-property-list">
          {
            signalItemKeyInfo?.subSignalItems.map((subSignalItemKeyInfo: SubSignalItemKeyInfo, idx: number) => {
              return (
                <div className="signal-property-list-item" key={subSignalItemKeyInfo.subSignalId}>
                  <div key={`${subSignalItemKeyInfo.subSignalId}-col-1`}>
                    <Row key={subSignalItemKeyInfo.subSignalId}>
                      <Col span={7} className="signal-property-text-right">
                        <label>灯泡ID:</label>
                      </Col>
                      <Col span={17}>
                        {`${subSignalItemKeyInfo.subSignalId}`}
                      </Col>
                    </Row>
                  </div>

                  <div key={`${subSignalItemKeyInfo.subSignalId}-col-2`}>
                    <Row key={subSignalItemKeyInfo.subSignalId}>
                      <Col span={7} className="signal-property-text-right">
                        <label>灯泡类型:</label>
                      </Col>
                      <Col span={17}>
                        <Select
                          className="signal-property-sub-signal-type"
                          value={subSignalItemKeyInfo.subSignalType}
                          onChange={(type: number) => {
                            alterSubSignalType(subSignalItemKeyInfo.subSignalId, type);
                          }}
                          options={convertAtlasSubSignalTypeToArray()}
                        ></Select>
                      </Col>
                    </Row>
                  </div>
                </div>
              );
            })
          }
        </div>

        <div className="signal-operation">
          <div key="remove" className="action" onClick={() => {
            removeSignal();
          }}>删除红绿灯</div>
        </div>
      </div>
    </div>
  );
}

export default SignalPropertyPanel;