import { useState, useCallback, useEffect, useMemo } from "react";
import {
  CloseCircleFilled
} from '@ant-design/icons';
import { Form, Row, Select, Col, Space } from 'antd';
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
import { InteractionMode } from '../../../../core/plugins/interactorManager/type';
import {
  EnterEditingSegmentAlignItemListEvent,
  RemoveSegmentAlignEvent,
  InitSegmentAlignOctreeInfoEvent,
  CurrentSegmentAlignMoseMoveLASPointCloud2DEvent,
} from '../../../../core/plugins/segmentAlignDrawer/constant';
import {
  SegmentAlignItemKeyInfo,
  SegmentAlignPointItemKeyInfo
} from '../../../../core/plugins/segmentAlignDrawer/type';
import {
  AlterInteractionModeEvent
} from '../../../../core/plugins/interactorManager/constant';
import {
  LASInfo
} from '../../../../core/plugins/lasLoader/type';
import {
  OctreeInfo
} from '../../../../core/plugins/octreeLoader/type';
import './index.scss';
import { Vector3 } from "@babylonjs/core";

function SegmentAlignPropertyPanel(props: RenderedFuncCompProps) {
  const [segmentAlignItemKeyInfoList, setSegmentAlignItemKeyInfoList] = useState<SegmentAlignItemKeyInfo[]>()
  const [cloudPointPosition, setCloudPointPosition] = useState<Vector3 | null>()
  const [octreeInfo, setOctreeInfo] = useState<OctreeInfo>()
  const [interactionMode, setInteractionMode] = useState<InteractionMode>()

  useEffect(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;


    pScope.onEvent(EnterEditingSegmentAlignItemListEvent, (params: { payload: Object | string | number | null }) => {
      const segmentAlignItemKeyInfoList = (params.payload as { segmentAlignItemKeyInfoList: SegmentAlignItemKeyInfo[] }).segmentAlignItemKeyInfoList;
      setSegmentAlignItemKeyInfoList(segmentAlignItemKeyInfoList);
    });

    pScope.onEvent(CurrentSegmentAlignMoseMoveLASPointCloud2DEvent, (params: { payload: Object | string | number | null }) => {
      const cloudPointPosition = (params.payload as { cloudPointPosition: Vector3 }).cloudPointPosition;
      setCloudPointPosition(cloudPointPosition);
    });


    pScope.onEvent(InitSegmentAlignOctreeInfoEvent, (params: { payload: Object | string | number | null }) => {
      const octreeInfo = (params.payload as { octreeInfo: OctreeInfo }).octreeInfo;
      setOctreeInfo(octreeInfo);
    });

    pScope.onEvent(AlterInteractionModeEvent, (params: { payload: Object | string | number | null }) => {
      const interactionMode = params.payload as InteractionMode;
      setInteractionMode(interactionMode);
    });

  }, []);

  const segmentAlignItemKeyInfoCenter2DCss = useCallback((segmentAlignPointItemKeyInfo: SegmentAlignPointItemKeyInfo[]) => {
    let css = {
      position: "absolute",
      display: "none",
      top: 0,
      left: 0,
    };
    if (segmentAlignPointItemKeyInfo.length !== 2) {
      return css;
    }
    const start = segmentAlignPointItemKeyInfo[0].position2D;
    const end = segmentAlignPointItemKeyInfo[1].position2D;
    if ((!start) || (!end)) {
      return {
        position: "absolute",
        display: "none",
        top: 0,
        left: 0,
      };
    }
    const left = (start?.pixelX + end?.pixelX) / 2;
    const top = (start?.pixelY + end?.pixelY) / 2;
    css = {
      position: "absolute",
      display: "block",
      top: top,
      left: left,
    };

    return css as object;
  }, [])

  const removeSegmentAlign = useCallback((segmentAlignId: string) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    pScope.emitEvent(RemoveSegmentAlignEvent, segmentAlignId);
  }, [props.pScope]);

  const resolveUtmPostion = useCallback((position: Vector3) => {
    if (!position) return;
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    const xyz =  octreeInfo?.pointcloud?.worldTransform?.position;
    if(!xyz) return position;
    const newPosition = {
      _x: position._x + xyz.x,
      _y: position._y + xyz.y,
      _z: position._z + xyz.z
    }
    return newPosition;
  }, [props.pScope, octreeInfo]);
  
  return (
    <div className="plugin-segment-align-property-panel-wrapper">
      {
        segmentAlignItemKeyInfoList?.map((segmentAlignItemKeyInfo: SegmentAlignItemKeyInfo) => {
          const startPosition = resolveUtmPostion(segmentAlignItemKeyInfo.segmentAlignPoints[0]?.position)
          const endPosition = resolveUtmPostion(segmentAlignItemKeyInfo.segmentAlignPoints[1]?.position)
          return (
            <div key={segmentAlignItemKeyInfo.segmentAlignId}>
              <div
                className="label_segment-align-item"
                style={segmentAlignItemKeyInfoCenter2DCss(segmentAlignItemKeyInfo.segmentAlignPoints)}
              >
                <div className="label_icon" onClick={() => removeSegmentAlign(segmentAlignItemKeyInfo.segmentAlignId)}>
                  <CloseCircleFilled />
                </div>
                <div className="title">&nbsp; distance {segmentAlignItemKeyInfo.segmentAlignId.replace('segmentAlign_Mesh_', '')}</div>
              </div>
            </div>
          )
        })
      }
      {
         interactionMode === InteractionMode.DrawSegmentAlign && cloudPointPosition ?
          <div className="moseMove">
            x: {resolveUtmPostion(cloudPointPosition)?._x.toFixed(3)} &nbsp;y: {resolveUtmPostion(cloudPointPosition)?._z.toFixed(3)} &nbsp; z: {resolveUtmPostion(cloudPointPosition)?._y.toFixed(3)}
          </div> : ''
      }
      {
        interactionMode === InteractionMode.DrawSegmentAlign && segmentAlignItemKeyInfoList?.length ?
          <div className="right_sidebar" >
            {
              segmentAlignItemKeyInfoList?.map((segmentAlignItemKeyInfo: SegmentAlignItemKeyInfo) => {
                const startPosition = resolveUtmPostion(segmentAlignItemKeyInfo.segmentAlignPoints[0]?.position)
                const endPosition = resolveUtmPostion(segmentAlignItemKeyInfo.segmentAlignPoints[1]?.position)
                return (
                  <div key={segmentAlignItemKeyInfo.segmentAlignId} className="sidebar_content">
                    <div className="title">{segmentAlignItemKeyInfo.segmentAlignId}</div>
                    <Row>
                      <Col span={12} style={{ textAlign: 'center' }}>
                        <Row>
                          <Col span={24}>
                            {segmentAlignItemKeyInfo.segmentAlignPoints[0].pointType}
                          </Col>
                        </Row>
                        <Row>
                          <Col span={6}>
                            X:
                          </Col>
                          <Col span={18}>
                            {startPosition?._x.toFixed(3)}
                          </Col>
                        </Row>
                        <Row>
                          <Col span={6}>
                            Y:
                          </Col>
                          <Col span={18}>
                            {startPosition?._z.toFixed(3)}
                          </Col>
                        </Row>
                        <Row>
                          <Col span={6}>
                            Z:
                          </Col>
                          <Col span={18}>
                            {startPosition?._y.toFixed(3)}
                          </Col>
                        </Row>
                      </Col>
                      <Col span={12} style={{ textAlign: 'center' }}>
                        <Row>
                          <Col span={24}>
                            {segmentAlignItemKeyInfo.segmentAlignPoints[1]?.pointType}
                          </Col>
                        </Row>
                        <Row>
                          <Col span={6}>
                            X:
                          </Col>
                          <Col span={18}>
                            {endPosition?._x.toFixed(3)}
                          </Col>
                        </Row>
                        <Row>
                          <Col span={6}>
                            Y:
                          </Col>
                          <Col span={18}>
                            {endPosition?._z.toFixed(3)}
                          </Col>
                        </Row>
                        <Row>
                          <Col span={6}>
                            Z:
                          </Col>
                          <Col span={18}>
                            {endPosition?._y.toFixed(3)}
                          </Col>
                        </Row>
                      </Col>
                    </Row>
                    <Row style={{ textAlign: 'center' }}>

                      <Col span={8}>
                        XY: {segmentAlignItemKeyInfo?.lasPlaneDistance}
                      </Col>
                      <Col span={8}>
                        Z: {segmentAlignItemKeyInfo?.lasAltitudeDistance}
                      </Col>
                      <Col span={8}>
                        XYZ: {segmentAlignItemKeyInfo?.lasSpaceDistance}
                      </Col>
                    </Row>
                  </div>
                )

              })
            }
          </div> : ''
      }
    </div>
  )
}

export default SegmentAlignPropertyPanel;