// import { useEffect } from 'react';
// import { Canvas } from '@react-three/fiber';
// import * as THREE from 'three';
// import RotationController from './RotationController'

//@ts-expect-error - React is just used for types
import React, { useState } from 'react'
import { API_PREFIX } from '../consts'
import axios from 'axios'
import LabelComponent from './LabelEditor'

const PointControls = ({
  id,
  point,
  reloadPoints,
}: {
  id: string | undefined
  point: {
    id: string
    x: number
    y: number
    type: number
  } | null
  reloadPoints: any
}) => {
  const [connectId, setConnectId] = useState<string>('')
  const [disconnectId, setDisconnectId] = useState<string>('')

  if (!id || !point) return <></>

  const connectToPoint = async () => {
    const id2 = Number(connectId)
    console.log('Connecting to:', id2)
    if (isNaN(id2)) return

    const result = await axios.post(
      `${API_PREFIX}/api/v1/point/${id}/connect/${id2}`
    )
    if (result.status == 201) {
      window.alert(`Successfully connected ID: ${id} to ID 2: ${id2}`)
      reloadPoints()
    } else if (result.status == 409) {
      window.alert(`Could not connect points! [${result.statusText}]`)
    } else {
      window.alert(`Unknown error: ${result.statusText}`)
    }
  }

  const disconnectFromPoint = async () => {
    const id2 = Number(disconnectId)
    console.log('Disconnecting from:', id2)
    if (isNaN(id2)) return

    const result = await axios.delete(
      `${API_PREFIX}/api/v1/point/${id}/connect/${id2}`
    )
    if (result.status == 201) {
      window.alert(`Successfully disconnected ID: ${id} to ID 2: ${id2}`)
      reloadPoints()
    } else if (result.status == 409) {
      window.alert(
        `Could not disconnect points - they may already be disconnected! [${result.statusText}]`
      )
    } else {
      window.alert(`Unknown error: ${result.statusText}`)
    }
  }

  const deletePoint = async () => {
    const result = await axios.delete(`${API_PREFIX}/api/v1/point/${id}/delete`)
    if (result.status == 200) {
      window.alert('Sucessfully removed!')
      reloadPoints()
    } else if (result.status == 409) {
      window.alert(`Could not delete point! [${result.statusText.toString()}]`)
    } else {
      window.alert(`Unknown error: ${result.statusText}`)
    }
  }

  console.log('Point Info', point)

  return (
    <div
      style={{
        margin: '5px',
        borderRadius: '5px',
        border: 'solid 1px',
        width: 'fit-content',
        height: 'fit-content',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h2>Point Info</h2>
      <ul>
        <li>Point ID: {point.id}</li>
        <li>X: {point.x * 100}%</li>
        <li>Y: {point.y * 100}%</li>
        <li>Type: {point.type}</li>
      </ul>

      <div className="my-3" style={{ border: 'dotted' }}>
        <LabelComponent id={Number(point.id)} />
      </div>
      <br />

      <img width={400} height={200} src={`${API_PREFIX}/api/v1/image/${id}`} />

      <button style={{ margin: '5px' }} onClick={deletePoint}>
        Delete Point
      </button>

      <div>
        <button style={{ margin: '5px' }} onClick={connectToPoint}>
          Connect To
        </button>
        <input
          type="text"
          id="connect-point-id"
          placeholder="e.g. 271"
          onChange={(e) => setConnectId(e.target.value)}
        />
      </div>

      <div>
        <button style={{ margin: '5px' }} onClick={disconnectFromPoint}>
          Disconnect From
        </button>
        <input
          type="text"
          id="disconnect-point-id"
          placeholder="e.g. 271"
          onChange={(e) => setDisconnectId(e.target.value)}
        />
      </div>
    </div>
  )
}

export default PointControls
