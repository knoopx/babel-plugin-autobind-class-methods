const template = require('babel-template')

export default ({types: t})=> ({
  visitor: {
    ClassExpression: (path, state)=> {
      const findBareSupers = {
        Super(path) {
          if (path.parentPath.isCallExpression({ callee: path.node })) {
            this.push(path.parentPath)
          }
        },
      }
      const isDerived = !!path.node.superClass
      let constructor
      const body = path.get('body')
      const methods = []
      for (const node of body.get('body')) {
        if (node.isClassMethod({ kind: 'constructor' })) {
          constructor = node
        } else if (node.isClassMethod({ kind: 'method' })) {
          methods.push(node.node.key)
        }
      }
      const name = '_makeJsClassGreatAgain'
      let uid
      if (!state.file.usedHelpers[name]) {
        state.file.metadata.usedHelpers.push(name)
        uid = state.file.scope.generateUidIdentifier(name)
        state.file.usedHelpers[name] = uid
        state.file.path.unshiftContainer('body', template('function UID(_this, funcName, params){return Object.getPrototypeOf(_this)[funcName].apply(_this, params)}')({UID: uid}))
      } else {
        uid = state.file.usedHelpers[name]
      }

      const newNodes = methods
        .map((method)=>
          template(`THIS.METHOD = (...rest) => UID(THIS, '${method.name}', rest)`)({UID: uid, THIS: t.thisExpression(), METHOD: method})
        )

      if (!constructor) {
        const newConstructor = t.classMethod('constructor', t.identifier('constructor'), [], t.blockStatement([]))
        if (isDerived) {
          newConstructor.params = [t.restElement(t.identifier('args'))]
          newConstructor.body.body.push(t.returnStatement(t.callExpression(t.super(), [t.spreadElement(t.identifier('args'))])))
        }
        constructor = body.unshiftContainer('body', newConstructor)[0]
      }

      if (isDerived) {
        const bareSupers = []
        constructor.traverse(findBareSupers, bareSupers)
        for (const bareSuper of bareSupers) {
          newNodes.forEach((node)=> {
            bareSuper.insertAfter(node)
          })
        }
      } else {
        newNodes.forEach((node)=> {
          constructor.get('body').unshiftContainer('body', node)
        })
      }
    },
  },
})
