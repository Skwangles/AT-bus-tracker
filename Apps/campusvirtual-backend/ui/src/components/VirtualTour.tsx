import React, { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import {
  OUTDOORS_LOCATION,
  SHOW_NAV_SEARCH,
  WAIKATO_UNI_LEVELS_ORDER,
} from '../consts'
import { API_PREFIX, showMap, PROJECT_NAME } from '../consts'
import axios from 'axios'
import CameraRotationControls from './RotationController'
import Instructions from './Instructions'
import Map from './Map'
import SearchBar from './SearchBar'
import { toast, ToastContainer, Bounce } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.min.css'

export interface PointData {
  pose: number[]
  ts: string
  keyframe_id: number
  location: string
}

import { ArrowDown, ArrowUp, MapPin, Sun } from 'react-feather'
import VirtualTourContent from './VirtualTourContent'
const VirtualTour: React.FC = () => {
  let params = new URLSearchParams(window.location.search)

  const [currentId, setCurrentId] = useState<string>(() => {
    if (params.has('id')) {
      return params.get('id') ?? '-1'
    }
    return '-1'
  })
  const [currentPoint, setCurrentPoint] = useState<PointData>({
    pose: [],
    ts: '',
    keyframe_id: 300,
    location: '',
  })

  const [floorWideNeighbours, setFloorWideNeighbours] = useState<any[]>([])
  const [locationGroup, setLocationGroup] = useState<string>('')
  const [highlightedPath, setHighlightedPath] = useState<number[]>([])
  const [allFloorNames, setAllFloorNames] = useState<string[]>([])

  const [camRotation, setCameraRotation] = useState<any>(() => {
    if (params.has('yaw') || params.has('pitch')) {
      return {
        yaw: Number(params.get('yaw') ?? camRotation['yaw'] ?? 0),
        pitch: Number(params.get('pitch') ?? camRotation['pitch'] ?? 0),
      }
    }
    return { yaw: 0, pitch: 0 }
  })

  const changeFloor = (requestedFloor: string) => {
    console.log('Fetching', requestedFloor)

    axios
      .get<{ keyframe_id: number }>(
        API_PREFIX + '/floor/' + requestedFloor + '/point'
      )
      .then((value) => {
        console.log(value.data)
        const result = value.data.keyframe_id
        if (isNaN(Number(result))) return
        console.log('Setting ID to ', result)
        setCurrentId(Number(result).toString())
      })
      .catch((reason) =>
        console.error('Floor could not be found: ' + reason.toString())
      )
  }

  useEffect(() => {
    // RUN ON FIRST LOAD
    axios.get<{ location: string }[]>(API_PREFIX + '/floors').then((result) => {
      console.log('Floors', result.data)
      setAllFloorNames(result.data.map((val) => String(val.location)))
    })

    if (currentId == '-1' || (params.has('id') && params.get('id') != '-1')) {
      changeFloor('FG.G')
    }
  }, [])

  useEffect(() => {
    document.title = locationGroup
      ? PROJECT_NAME + ' - ' + locationGroup
      : PROJECT_NAME
    params.set('id', currentId)
    history.pushState({}, '', '?' + params.toString())
  }, [
    currentId,
    locationGroup /* DO NOT INCLUDE 'params' otherwise any yaw/pitch change will trigger it */,
  ])

  useEffect(() => {
    params.set('yaw', Number(camRotation['yaw']).toFixed(4))
    params.set('pitch', Number(camRotation['pitch']).toFixed(4))
    history.replaceState({}, '', '?' + params.toString())
  }, [camRotation])

  useEffect(() => {
    setLocationGroup(currentPoint.location)
  }, [currentPoint])

  window.onpopstate = (e) => {
    params = new URLSearchParams(window.location.search)
    if (params.has('id')) {
      setCurrentId(params.get('id') ?? '0')
    }

    if (params.has('yaw') || params.has('pitch')) {
      setCameraRotation({
        yaw: Number(params.get('yaw') ?? camRotation['yaw'] ?? 0),
        pitch: Number(params.get('pitch') ?? camRotation['pitch'] ?? 0),
      })
    }
  }

  const calculateHighlightedPath = async (selectedLocation: string) => {
    try {
      const response = await axios.get(
        `/point/${currentId}/path/${selectedLocation}`
      )
      console.log('API Response:', response.data)
      if (!response.data || !response.data.path) {
        toast.error('Something went wrong calculating a path!')
      } else {
        setHighlightedPath(response.data?.path)
        toast.success(
          `Path to Floor: ${selectedLocation} is now highlighted, follow the blue dots...`
        )
      }
    } catch (error) {
      console.error('API Error:', error)
      toast.error('Something went wrong fetching the path, try again later!')
    }
  }

  useEffect(() => {
    if (
      highlightedPath.length > 0 &&
      highlightedPath.includes(Number(currentId))
    ) {
      setHighlightedPath(
        highlightedPath.indexOf(Number(currentId)) == highlightedPath.length - 1
          ? []
          : highlightedPath.slice(highlightedPath.indexOf(Number(currentId)))
      )
    }
  }, [currentId])

  const getFloorUpOrDown = (floor: string, isUp = true) => {
    if (!floor.includes('.')) return false
    const splitName = floor.split('.')
    if (splitName.length == 0 || splitName.length > 2) {
      return false
    }

    let idx = WAIKATO_UNI_LEVELS_ORDER.indexOf(splitName[1])
    if (isUp) {
      idx += 1
      while (idx < WAIKATO_UNI_LEVELS_ORDER.length) {
        if (
          allFloorNames.includes(
            splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
          )
        ) {
          return splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
        }
        idx += 1
      }
    } else {
      idx -= 1
      while (idx >= 0) {
        if (
          allFloorNames.includes(
            splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
          )
        ) {
          return splitName[0] + '.' + WAIKATO_UNI_LEVELS_ORDER[idx]
        }
        idx -= 1
      }
    }
    return false
  }

  const [canGoUp, setCanGoUp] = useState(false)
  const [canGoDown, setCanGoDown] = useState(false)

  useEffect(() => {
    setCanGoUp(!!getFloorUpOrDown(locationGroup, true))
    setCanGoDown(!!getFloorUpOrDown(locationGroup, false))
  }, [locationGroup])

  const changeFloorUpOrDown = (floor: string, isUp: boolean) => {
    const newFloor = getFloorUpOrDown(floor, isUp)
    if (!newFloor) {
      toast.warn(
        'Cannot change floor - No floor is ' + (isUp ? 'above' : 'below')
      )
      return
    }

    if (allFloorNames.includes(newFloor)) {
      console.log('Setting location to', newFloor)
      changeFloor(newFloor)
    }
  }

  return (
    <>
      <div
        className="w-fit flex flex-row justify-center items-center  mb-2 ml-2"
        style={{
          background: '#101010F0',
          color: 'white',
          position: 'fixed',
          left: 0,
          bottom: 0,
          zIndex: 999,
          fontSize: '2rem',
          padding: '10px',
          borderRadius: '10px',
        }}
      >
        <MapPin className="mr-1" />
        You are in: {currentPoint.location}
      </div>
      <div className="fixed bottom-0 right-0 z-50 flex flex-row items-end mb-2 mr-2">
        <button
          className="w-18 h-fit mr-2 bg-green-600"
          disabled={!canGoUp}
          onClick={() => changeFloorUpOrDown(locationGroup, true)}
        >
          <ArrowUp /> Floor
        </button>
        <button
          className="w-18 h-fit mr-2 bg-green-600"
          disabled={!canGoDown}
          onClick={() => changeFloorUpOrDown(locationGroup, false)}
        >
          <ArrowDown /> Floor
        </button>
        <button
          className="w-18 h-fit mr-2 bg-green-600"
          disabled={!allFloorNames.includes(OUTDOORS_LOCATION)}
          onClick={() => changeFloor(OUTDOORS_LOCATION)}
        >
          <Sun /> Go Outdoors
        </button>

        <Instructions point={currentPoint} />
      </div>
      {showMap && (
        <Map
          floorName={locationGroup}
          setID={setCurrentId}
          currentId={currentId}
          highlightedPath={highlightedPath}
        />
      )}

      {SHOW_NAV_SEARCH && allFloorNames.length > 0 && (
        <>
          <SearchBar
            data={allFloorNames}
            highlightCallback={calculateHighlightedPath}
            jumpToCallback={changeFloor}
          />
          <div className="fixed right-0 top-0 flex flex-col z-50">
            {highlightedPath.length > 0 && (
              <button
                className="bg-gray-600 z-50"
                style={{
                  // background: '#4d4c4c',
                  color: 'white',
                }}
                onClick={() => setHighlightedPath([])}
              >
                Clear Highlight
              </button>
            )}
          </div>
        </>
      )}

      <div style={{ width: '100vw', height: '100vh' }}>
        <Canvas camera={{ position: [0, 0, 10], fov: 75 }} shadows>
          <ambientLight intensity={0.6} />
          <directionalLight castShadow />
          <CameraRotationControls
            initCameraRotation={camRotation}
            setCameraRotation={setCameraRotation}
          />
          <VirtualTourContent
            currentId={currentId}
            setCurrentId={setCurrentId}
            currentPoint={currentPoint}
            setCurrentPoint={setCurrentPoint}
            setNeighbours={setFloorWideNeighbours}
            neighbours={floorWideNeighbours}
            isRefined={true}
            highlightedPath={highlightedPath}
          />
        </Canvas>
      </div>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
        transition={Bounce}
      />
    </>
  )
}

export default VirtualTour
