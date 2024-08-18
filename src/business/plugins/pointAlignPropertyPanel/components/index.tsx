import { useState, useCallback, useEffect, useMemo } from "react";
import {
  CloseCircleFilled
} from '@ant-design/icons';
import { Form, Row, Select, Col } from 'antd';
import { RenderedFuncCompProps } from '../../../../core/hoc/withRenderer';
import { ExtendedNamespace } from '../../../../core/types/plugins/raw';
import { InteractionMode } from '../../../../core/plugins/interactorManager/type';
import {
  Vector3,
} from "@babylonjs/core";
import {
  PointAlignItem,
  PointAlignItemKeyInfo,
} from '../../../../core/plugins/pointAlignDrawer/type';
import {
  RemovePointAlignEvent
} from '../../../../core/plugins/pointAlignDrawer/constant';
import {
  EnterEditingPointAlignItemListEvent,
  CurrentPointAlignMoseMoveLASPointCloud2DEvent,
  InitPointAlignOctreeInfoEvent,
} from '../../../../core/plugins/pointAlignDrawer/constant';
import {
  LASInfo
} from '../../../../core/plugins/lasLoader/type';
import {
  OctreeInfo
} from '../../../../core/plugins/octreeLoader/type';
import {
  AlterInteractionModeEvent
} from '../../../../core/plugins/interactorManager/constant';
import './index.scss';


function PointAlignPropertyPanel(props: RenderedFuncCompProps) {
  const [pointAlignItemKeyInfoList, setPointAlignItemKeyInfoList] = useState<PointAlignItemKeyInfo[]>()
  const [cloudPointPosition, setCloudPointPosition] = useState<Vector3 | null>()
  const [currentLasInfo, setCurrentLasInfo] = useState<LASInfo>()
  const [octreeInfo, setOctreeInfo] = useState<OctreeInfo>()
  const [interactionMode, setInteractionMode] = useState<InteractionMode>()

  useEffect(() => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;

    pScope.onEvent(EnterEditingPointAlignItemListEvent, (params: { payload: Object | string | number | null }) => {
      const pointAlignItemKeyInfoList = (params.payload as { pointAlignItemKeyInfoList: PointAlignItemKeyInfo[] }).pointAlignItemKeyInfoList;
      setPointAlignItemKeyInfoList(pointAlignItemKeyInfoList);
    });

    pScope.onEvent(CurrentPointAlignMoseMoveLASPointCloud2DEvent, (params: { payload: Object | string | number | null }) => {
      const cloudPointPosition = (params.payload as { cloudPointPosition: Vector3 }).cloudPointPosition;
      setCloudPointPosition(cloudPointPosition);
    });

    pScope.onEvent(InitPointAlignOctreeInfoEvent, (params: { payload: Object | string | number | null }) => {
      const octreeInfo = (params.payload as { octreeInfo: OctreeInfo }).octreeInfo;
      setOctreeInfo(octreeInfo);
      // setCurrentLasInfo(octreeInfo);
    });

    pScope.onEvent(AlterInteractionModeEvent, (params: { payload: Object | string | number | null }) => {
      const interactionMode = params.payload as InteractionMode;
      setInteractionMode(interactionMode);
    });

  }, []);


  const removePointAlign = useCallback((pointAlignId: string) => {
    const pScope = (props.pScope) as unknown as ExtendedNamespace;
    pScope.emitEvent(RemovePointAlignEvent, pointAlignId);
  }, [props.pScope, pointAlignItemKeyInfoList]);

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
    <div className="plugin-point_align-property-panel-wrapper">
      {
        pointAlignItemKeyInfoList?.map((pointAlignItemkeyInfo: PointAlignItemKeyInfo) => {
          return (
            <div key={pointAlignItemkeyInfo.pointAlignId} className="label"
              style={{
                position: "absolute",
                left: pointAlignItemkeyInfo?.pointAlignlasPoint2D?.pixelX,
                top: pointAlignItemkeyInfo?.pointAlignlasPoint2D?.pixelY,
              }}>
              <div className="label_icon" onClick={() => removePointAlign(pointAlignItemkeyInfo.pointAlignId)}>
                <CloseCircleFilled />
              </div>
              <div className="title">&nbsp; point {pointAlignItemkeyInfo.pointAlignId.replace('pointsAlign_Mesh_', '')}</div>
            </div>
          )
        })
      }
      {
        interactionMode === InteractionMode.DrawPointAlign  && cloudPointPosition ?
          <div className="moseMove">
            x: {resolveUtmPostion(cloudPointPosition)?._x.toFixed(3)} &nbsp;y: {resolveUtmPostion(cloudPointPosition)?._z.toFixed(3)} &nbsp; z: {resolveUtmPostion(cloudPointPosition)?._y.toFixed(3)}
          </div> : ''
      }
      {
        interactionMode === InteractionMode.DrawPointAlign  && pointAlignItemKeyInfoList?.length ?
          <div className="right_sidebar">
            {
              pointAlignItemKeyInfoList?.map((pointAlignItemkeyInfo: PointAlignItemKeyInfo) => {
                const point = resolveUtmPostion(pointAlignItemkeyInfo.pointAlignPoint)
                return (
                  <div key={pointAlignItemkeyInfo.pointAlignId} className="sidebar_content"
                  >
                    <div className="title">{pointAlignItemkeyInfo.pointAlignId}</div>
                    <div className="point">
                      <Row >
                        <Col span={3}>x: </Col>
                        <Col span={21}>{point?._x.toFixed(3)}</Col>
                      </Row>
                      <Row  >
                        <Col span={3}>y: </Col>
                        <Col span={21}>{point?._z.toFixed(3)}</Col>
                      </Row>
                      <Row >
                        <Col span={3}>z: </Col>
                        <Col span={21}>{point?._y.toFixed(3)}</Col>
                      </Row>
                    </div>

                  </div>
                )
              })
            }
          </div> : ''
      }

    </div>
  )

}

export default PointAlignPropertyPanel;