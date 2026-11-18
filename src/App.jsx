
import { useEffect, useRef, useState } from 'react'
import './App.css'

const ROW_COUNT = 5
const OVERLAP = 6
const TEAR_SEGMENTS = 32

const startingPositions = [
  { x: 8, y: 5, rotation: 180 },
  { x: 55, y: 8, rotation: 12 },

  { x: 10, y: 24, rotation: -180 },
  { x: 53, y: 26, rotation: -21 },

  { x: 7, y: 43, rotation: 16 },
  { x: 55, y: 45, rotation: 180 },

  { x: 12, y: 62, rotation: 20 },
  { x: 38, y: 67, rotation: -180 },

  { x: 52, y: 64, rotation: 7 },
  { x: 8, y: 81, rotation: -23 },

  { x: 54, y: 83, rotation: 180 },
]

const cutDefinitions = [
  { left: 19, right: 25, seed: 1.4 },
  { left: 40, right: 34, seed: 3.1 },
  { left: 61, right: 68, seed: 4.7 },
  { left: 81, right: 74, seed: 6.2 },
]

function createTear(left, right, seed) {
  const points = []

  for (let i = 0; i <= TEAR_SEGMENTS; i++) {
    const progress = i / TEAR_SEGMENTS

    const diagonal = left + (right - left) * progress

    const wave =
      Math.sin(progress * Math.PI * 5 + seed) * 0.55

    const smallWave =
      Math.sin(progress * Math.PI * 13 + seed * 1.7) * 0.22

    points.push(diagonal + wave + smallWave)
  }

  return points
}

/*
  Split Piece 7 into two separate fragments.
  Left side: approximately 75%.
  Right side: approximately 25%.
*/



function splitPieceCanvas(sourceCanvas) {
  const width = sourceCanvas.width
  const height = sourceCanvas.height

  const boundaryAt = (progress) =>
    width * (
      0.85 +
      Math.sin(progress * Math.PI * 4 + 0.8) * 0.012 +
      Math.sin(progress * Math.PI * 9 + 1.4) * 0.006
    )

  const boundaries = Array.from(
    { length: 65 },
    (_, i) => boundaryAt(i / 64)
  )

  const minBoundary = Math.floor(Math.min(...boundaries))
  const maxBoundary = Math.ceil(Math.max(...boundaries))

  function createHalf(isLeft) {
    const cropLeft = isLeft ? 0 : minBoundary
    const cropRight = isLeft ? maxBoundary : width

    const canvas = document.createElement('canvas')

    canvas.width = cropRight - cropLeft
    canvas.height = height

    const ctx = canvas.getContext('2d')

    // Preserve original pixel size and full height.
    ctx.drawImage(
      sourceCanvas,
      cropLeft,
      0,
      canvas.width,
      height,
      0,
      0,
      canvas.width,
      height
    )

    ctx.globalCompositeOperation = 'destination-in'
    ctx.beginPath()

    if (isLeft) {
      ctx.moveTo(0, 0)

      for (let i = 0; i <= 64; i++) {
        ctx.lineTo(
          boundaryAt(i / 64) - cropLeft,
          (i / 64) * height
        )
      }

      ctx.lineTo(0, height)
    } else {
      ctx.moveTo(
        boundaryAt(0) - cropLeft,
        0
      )

      ctx.lineTo(canvas.width, 0)
      ctx.lineTo(canvas.width, height)

      for (let i = 64; i >= 0; i--) {
        ctx.lineTo(
          boundaryAt(i / 64) - cropLeft,
          (i / 64) * height
        )
      }
    }

    ctx.closePath()
    ctx.fill()

    ctx.globalCompositeOperation = 'source-over'

    return canvas
  }

  return {
    left: createHalf(true),
    right: createHalf(false),
  }
}


/*
  Remove transparent margins while retaining
  the original image proportions.
*/

function trimCanvas(source) {
  const ctx = source.getContext('2d')
  const { width, height } = source

  const pixels = ctx.getImageData(
    0, 0, width, height
  ).data

  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = pixels[(y * width + x) * 4 + 3]

      if (alpha > 10) {
        minX = Math.min(minX, x)
        minY = Math.min(minY, y)
        maxX = Math.max(maxX, x)
        maxY = Math.max(maxY, y)
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return source
  }

  const trimmed = document.createElement('canvas')

  trimmed.width = maxX - minX + 1
  trimmed.height = maxY - minY + 1

  trimmed.getContext('2d').drawImage(
    source,
    minX,
    minY,
    trimmed.width,
    trimmed.height,
    0,
    0,
    trimmed.width,
    trimmed.height
  )

  return trimmed
}


function canvasToPiece(
  canvas,
  id,
  position,
  displayFraction = 1
) {
  return {
    ...position,
    id,
    image: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    displayFraction,
  }
}



function App() {
  const [pieces, setPieces] = useState([])
  const [selectedPiece, setSelectedPiece] = useState(null)

  const interaction = useRef(null)

  /*
  ------------------------------------------
  LOAD RECEIPT
  ------------------------------------------
  */

  useEffect(() => {
    const image = new Image()

    image.src = `${import.meta.env.BASE_URL}images/froyo_receipt.png`

    image.onload = () => {
      const sourceCanvas = document.createElement('canvas')

      sourceCanvas.width = image.naturalWidth
      sourceCanvas.height = image.naturalHeight

      const sourceContext = sourceCanvas.getContext('2d', {
        willReadFrequently: true,
      })

      sourceContext.drawImage(image, 0, 0)

      const pixels = sourceContext.getImageData(
        0, 0, sourceCanvas.width, sourceCanvas.height
      ).data

      let minX = sourceCanvas.width
      let minY = sourceCanvas.height
      let maxX = 0
      let maxY = 0

      for (let y = 0; y < sourceCanvas.height; y++) {
        for (let x = 0; x < sourceCanvas.width; x++) {
          const alpha =
            pixels[(y * sourceCanvas.width + x) * 4 + 3]

          if (alpha > 10) {
            minX = Math.min(minX, x)
            minY = Math.min(minY, y)
            maxX = Math.max(maxX, x)
            maxY = Math.max(maxY, y)
          }
        }
      }

      if (minX > maxX || minY > maxY) {
        minX = 0
        minY = 0
        maxX = sourceCanvas.width - 1
        maxY = sourceCanvas.height - 1
      }

      const receiptWidth = maxX - minX + 1
      const receiptHeight = maxY - minY + 1

      const tears = cutDefinitions.map((cut) =>
        createTear(cut.left, cut.right, cut.seed)
      )

      const centerTear = []

      for (let i = 0; i <= TEAR_SEGMENTS; i++) {
        const progress = i / TEAR_SEGMENTS

        const wave =
          Math.sin(progress * Math.PI * 5 + 1.8) * 0.7

        const smallWave =
          Math.sin(progress * Math.PI * 13 + 0.6) * 0.25

        centerTear.push(50 + wave + smallWave)
      }

      const getY = (percentage) =>
        minY + (percentage / 100) * receiptHeight

      const getX = (percentage) =>
        minX + (percentage / 100) * receiptWidth

      const centerX = centerTear.map(getX)

      const centerMinX = Math.min(...centerX)
      const centerMaxX = Math.max(...centerX)

      const generatedPieces = []

      /*
      ------------------------------------------
      CREATE FIVE ROWS
      ------------------------------------------
      */

      for (let row = 0; row < ROW_COUNT; row++) {
        const topBoundary =
          row === 0
            ? Array.from(
                { length: TEAR_SEGMENTS + 1 },
                () => minY
              )
            : tears[row - 1].map(getY)

        const bottomBoundary =
          row === ROW_COUNT - 1
            ? Array.from(
                { length: TEAR_SEGMENTS + 1 },
                () => maxY + 1
              )
            : tears[row].map(getY)

        const allY = [
          ...topBoundary,
          ...bottomBoundary,
        ]

        const cropTop = Math.max(
          minY,
          Math.floor(Math.min(...allY) - OVERLAP)
        )

        const cropBottom = Math.min(
          maxY + 1,
          Math.ceil(Math.max(...allY) + OVERLAP)
        )

        const cropHeight = cropBottom - cropTop

        /*
        ------------------------------------------
        CREATE LEFT AND RIGHT PIECES
        ------------------------------------------
        */

        for (let side = 0; side < 2; side++) {
          let cropLeft
          let cropRight

          if (side === 0) {
            cropLeft = minX
            cropRight = centerMaxX + OVERLAP
          } else {
            cropLeft = centerMinX - OVERLAP
            cropRight = maxX + 1
          }

          cropLeft = Math.max(minX, cropLeft)
          cropRight = Math.min(maxX + 1, cropRight)

          const pieceWidth = cropRight - cropLeft

          const pieceCanvas = document.createElement('canvas')

          pieceCanvas.width = Math.round(pieceWidth)
          pieceCanvas.height = Math.round(cropHeight)

          const pieceContext = pieceCanvas.getContext('2d')

          pieceContext.drawImage(
            image,
            cropLeft,
            cropTop,
            pieceWidth,
            cropHeight,
            0,
            0,
            pieceWidth,
            cropHeight
          )

          /*
          Apply irregular tear clipping.
          */

          pieceContext.globalCompositeOperation = 'destination-in'
          pieceContext.beginPath()

          if (side === 0) {
            pieceContext.moveTo(
              0,
              topBoundary[0] - cropTop
            )

            for (let i = 0; i <= TEAR_SEGMENTS; i++) {
              pieceContext.lineTo(
                centerX[i] - cropLeft,
                topBoundary[i] - cropTop
              )
            }

            pieceContext.lineTo(
              pieceWidth,
              topBoundary[TEAR_SEGMENTS] - cropTop
            )
          } else {
            pieceContext.moveTo(
              centerX[0] - cropLeft,
              topBoundary[0] - cropTop
            )

            for (let i = 0; i <= TEAR_SEGMENTS; i++) {
              pieceContext.lineTo(
                centerX[i] - cropLeft,
                topBoundary[i] - cropTop
              )
            }

            pieceContext.lineTo(
              pieceWidth,
              topBoundary[TEAR_SEGMENTS] - cropTop
            )
          }

          pieceContext.lineTo(
            pieceWidth,
            bottomBoundary[TEAR_SEGMENTS] - cropTop
          )

          for (let i = TEAR_SEGMENTS; i >= 0; i--) {
            pieceContext.lineTo(
              centerX[i] - cropLeft,
              bottomBoundary[i] - cropTop
            )
          }

          pieceContext.lineTo(
            0,
            bottomBoundary[0] - cropTop
          )

          pieceContext.closePath()
          pieceContext.fill()

          pieceContext.globalCompositeOperation = 'source-over'

          const pieceId = row * 2 + side + 1

          /*
          SPECIAL SPLIT: PIECE 7
          */
        
        if (pieceId === 7) {
          const split = splitPieceCanvas(pieceCanvas)

          generatedPieces.push(
            canvasToPiece(
              split.left,
              7,
              startingPositions[6],
              split.left.width / pieceCanvas.width
            )
          )

          generatedPieces.push(
            canvasToPiece(
              split.right,
              11,
              startingPositions[7],
              split.right.width / pieceCanvas.width
            )
          )
        } else {
          const positionIndex =
            pieceId < 7
              ? pieceId - 1
              : pieceId

          generatedPieces.push(
            canvasToPiece(
              pieceCanvas,
              pieceId,
              startingPositions[positionIndex]
            )
          )
        }


        }
      }

      setPieces(generatedPieces)
    }

    image.onerror = () => {
      console.error(
        'Could not load /images/froyo_receipt.png'
      )
    }
  }, [])

  
  /*
  ------------------------------------------
  UPDATE PIECE
  ------------------------------------------
  */

  const updatePiece = (id, changes) => {
    setPieces((current) =>
      current.map((piece) =>
        piece.id === id
          ? { ...piece, ...changes }
          : piece
      )
    )
  }

  /*
  ------------------------------------------
  START DRAG
  ------------------------------------------
  */

  const startDrag = (event, id) => {
    event.preventDefault()
    event.stopPropagation()

    const field = event.currentTarget.parentElement
    const fieldRect = field.getBoundingClientRect()

    const piece = pieces.find(
      (item) => item.id === id
    )

    if (!piece) return

    interaction.current = {
      type: 'drag',
      id,
      fieldRect,

      offsetX:
        event.clientX -
        (
          fieldRect.left +
          (piece.x / 100) * fieldRect.width
        ),

      offsetY:
        event.clientY -
        (
          fieldRect.top +
          (piece.y / 100) * fieldRect.height
        ),
    }

    setSelectedPiece(id)
  }

  /*
  ------------------------------------------
  START ROTATION
  ------------------------------------------
  */

  const startRotate = (event, id) => {
    event.preventDefault()
    event.stopPropagation()

    const pieceElement = event.currentTarget.parentElement
    const rect = pieceElement.getBoundingClientRect()

    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2

    const startAngle =
      Math.atan2(
        event.clientY - centerY,
        event.clientX - centerX
      ) * (180 / Math.PI)

    const piece = pieces.find(
      (item) => item.id === id
    )

    if (!piece) return

    interaction.current = {
      type: 'rotate',
      id,
      centerX,
      centerY,
      startAngle,
      startRotation: piece.rotation,
    }

    setSelectedPiece(id)
  }

  /*
  ------------------------------------------
  POINTER MOVEMENT
  ------------------------------------------
  */

  const moveInteraction = (event) => {
    const action = interaction.current

    if (!action) return

    if (action.type === 'drag') {
      const x =
        (
          (
            event.clientX -
            action.fieldRect.left -
            action.offsetX
          ) /
          action.fieldRect.width
        ) * 100

      const y =
        (
          (
            event.clientY -
            action.fieldRect.top -
            action.offsetY
          ) /
          action.fieldRect.height
        ) * 100

      updatePiece(action.id, { x, y })
    }

    if (action.type === 'rotate') {
      const currentAngle =
        Math.atan2(
          event.clientY - action.centerY,
          event.clientX - action.centerX
        ) * (180 / Math.PI)

      updatePiece(action.id, {
        rotation:
          action.startRotation +
          currentAngle -
          action.startAngle,
      })
    }
  }

  /*
  ------------------------------------------
  END INTERACTION
  ------------------------------------------
  */

  const endInteraction = () => {
    interaction.current = null
  }

  /*
  ------------------------------------------
  RENDER
  ------------------------------------------
  */

  return (
    <main className="game">

      <header className="game-header">
        <span>221B / EVIDENCE</span>
        <span>RECEIPT / 001</span>
      </header>

      <section className="intro">

        <p className="eyebrow">
          DOCUMENT RECONSTRUCTION
        </p>

        <h1>
          UNSCRAMBLE
          <br />
          <em>THE RECEIPT.</em>
        </h1>

        <p className="instructions">
          The document has been
          torn apart. Reconstruct
          the receipt to reveal
          the evidence.
        </p>

      </section>

      <section className="puzzle">

        <div className="puzzle-label">
          <span>FRAGMENTS</span>
          <span>{pieces.length || 11} PIECES</span>
        </div>

        <div
          className="piece-field"
          onPointerMove={moveInteraction}
          onPointerUp={endInteraction}
          onPointerCancel={endInteraction}
        >

          {pieces.map((piece) => (

            <div
              key={piece.id}

              className={`receipt-piece ${
                selectedPiece === piece.id
                  ? 'selected'
                  : ''
              }`}

              style={{
                left: `${piece.x}%`,
                top: `${piece.y}%`,
                transform: `rotate(${piece.rotation}deg)`,

                width: `calc(min(44vw, 220px) * ${piece.displayFraction || 1})`,

                aspectRatio: `${piece.width} / ${piece.height}`,
              }}

              onPointerDown={(event) =>
                startDrag(event, piece.id)
              }
            >

              <img
                className="receipt-piece-image"
                src={piece.image}
                alt=""
                draggable="false"
              />

              {selectedPiece === piece.id && (

                <button
                  className="rotate-handle"
                  aria-label="Rotate receipt piece"
                  onPointerDown={(event) =>
                    startRotate(event, piece.id)
                  }
                >
                  ↻
                </button>

              )}

            </div>

          ))}

        </div>

      </section>

      <footer className="game-footer">
        <span>CASE / 221B</span>
        <span>RECONSTRUCTION REQUIRED</span>
      </footer>

    </main>
  )
}

export default App
