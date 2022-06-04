// 下个任务单元
let nextUnitOfWork = null
let wipRoot = null
let currentRoot = null
let deletions = []
let wipFiber = []
let hooksIndex = 0

function reconcileChildren(wipFiber, elements) {
  let index = 0
  let preSibling = null
  let oldFiber = wipFiber.alternate && wipFiber.alternate.child

  while (index < elements.length || !!oldFiber) {
    const childrenElement = elements[index]
    let newFiber = null
    const sameType =
      oldFiber && childrenElement && childrenElement.type === oldFiber.type

    if (sameType) {
      newFiber = {
        type: oldFiber.type,
        props: childrenElement.props,
        dom: oldFiber.dom,
        parent: wipFiber,
        alternate: oldFiber,
        effectTag: 'UPDATE',
      }
    }

    if (!sameType && childrenElement) {
      newFiber = {
        type: childrenElement.type,
        props: childrenElement.props,
        dom: null,
        parent: wipFiber,
        alternate: null,
        effectTag: 'PLACEMENT',
      }
    }

    if (!sameType && oldFiber) {
      oldFiber.effectTag = 'DELETION'
      deletions.push(oldFiber)
    }

    if (oldFiber) {
      oldFiber = oldFiber.sibling
    }

    if (index === 0) {
      wipFiber.child = newFiber
    } else {
      preSibling.sibling = newFiber
    }

    preSibling = newFiber
    index++
  }
}

export function useState(initial) {
  const oldHook = wipFiber?.alternate?.hooks?.[hooksIndex]
  const hook = {
    state: oldHook ? oldHook.state : initial,
    queue: [],
  }
  const actions = oldHook ? oldHook.queue : []
  actions.forEach((action) => {
    hook.state = action
  })

  const setState = (action) => {
    hook.queue.push(action)
    wipRoot = {
      dom: currentRoot.dom,
      props: currentRoot.props,
      alternate: currentRoot,
    }
    console.log(wipRoot)
    nextUnitOfWork = wipRoot
    deletions = []
  }
  wipFiber.hooks.push(hook)
  hooksIndex++
  return [hook.state, setState]
}

function updateFunctionComponent(fiber) {
  wipFiber = fiber
  wipFiber.hooks = []
  hooksIndex = 0
  const children = [fiber.type(fiber.props)]
  reconcileChildren(fiber, children)
}

function updateHostComponent(fiber) {
  if (!fiber.dom) {
    fiber.dom = createDom(fiber)
  }
  // 为当前的fiber创建他子节点的fiber

  const elements = fiber?.props?.children
  reconcileChildren(fiber, elements)
}

function perforUnitOfWork(fiber) {
  // 执行任务单元  reactElement转换为真实dom
  const isFunctionComponent = fiber.type instanceof Function
  if (isFunctionComponent) {
    updateFunctionComponent(fiber)
  } else {
    updateHostComponent(fiber)
  }

  // return出下一个任务单元
  if (fiber.child) {
    return fiber.child
  }

  let nextFiber = fiber
  while (nextFiber) {
    if (nextFiber.sibling) {
      return nextFiber.sibling
    }
    nextFiber = nextFiber.parent
  }
}
// 筛选出事件
const isEvent = (key) => key.startsWith('on')
// 筛选出不是children的属性
const isProperty = (key) => key !== 'children' && !isEvent(key)
// 筛选出要移除的属性
const isGone = (prev, next) => (key) => !(key in next)
// 挑选出新的属性
const isNew = (prev, next) => (key) => prev[key] !== next[key]
function updateDom(dom, prevProps, nextProps) {
  console.log(prevProps)
  // 移除掉旧的监听事件
  Object.keys(prevProps)
    .filter(isEvent)
    .filter(
      (key) =>
        isGone(prevProps, nextProps)(key) || isNew(prevProps, nextProps)(key)
    )
    .forEach((name) => {
      const eventType = name.toLocaleLowerCase().substring(2)
      dom.removeEventListener(eventType, prevProps[name])
    })
  // 移除掉不存在新props里的属性
  Object.keys(prevProps)
    .filter(isProperty)
    .filter(isGone(prevProps, nextProps))
    .forEach((name) => (dom[name] = ''))
  // 新增的属性
  Object.keys(nextProps)
    .filter(isProperty)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => (dom[name] = nextProps[name]))
  // 新增事件
  Object.keys(nextProps)
    .filter(isEvent)
    .filter(isNew(prevProps, nextProps))
    .forEach((name) => {
      const eventType = name.toLocaleLowerCase().substring(2)
      dom.addEventListener(eventType, nextProps[name])
    })
}

function commitDeletion(fiber, domParent) {
  if (fiber.dom) {
    domParent.removeChild(fiber.dom)
  } else {
    commitDeletion(fiber.child, domParent)
  }
}

function commitWork(fiber) {
  if (!fiber) return

  // const domParent = fiber.parent.dom
  let domParentFiber = fiber.parent
  while (!domParentFiber.dom) {
    domParentFiber = domParentFiber.parent
  }

  const domParent = domParentFiber.dom
  // domParent.appendChild(fiber.dom)
  switch (fiber.effectTag) {
    case 'PLACEMENT':
      !!fiber.dom && domParent.appendChild(fiber.dom)
      break
    case 'UPDATE':
      !!fiber.dom && updateDom(fiber.dom, fiber.alternate, fiber.props)
      break
    case 'DELETION':
      // !!fiber.dom && domParent.removeChild(fiber.dom)
      commitDeletion(fiber, domParent)
      break

    default:
      break
  }
  commitWork(fiber.child)
  commitWork(fiber.sibling)
}

function commitRoot() {
  // 做渲染真实DOM的操作
  console.log(wipRoot)
  commitWork(wipRoot.child)
  deletions.forEach(commitWork)
  currentRoot = wipRoot
  wipRoot = null
}

function workLoop(deadline) {
  let shouldYield = true

  while (nextUnitOfWork && shouldYield) {
    nextUnitOfWork = perforUnitOfWork(nextUnitOfWork)
    shouldYield = deadline.timeRemaining() > 1
  }

  if (!nextUnitOfWork && wipRoot) {
    commitRoot()
  }
  // deadline.timeRemaining() 得到浏览器当前帧剩余的时间  react实现了scheduler
  requestIdleCallback(workLoop)
}
requestIdleCallback(workLoop)

function createDom(fiber) {
  const dom =
    fiber.type === 'TEXT_ELEMENT'
      ? document.createTextNode('')
      : document.createElement(fiber.type)
  updateDom(dom, {}, fiber.props)
  return dom
}

export function render(element, container) {
  wipRoot = {
    dom: container,
    props: {
      children: [element],
    },
    alternate: currentRoot,
  }
  console.log(wipRoot)
  nextUnitOfWork = wipRoot
  deletions = []
}
