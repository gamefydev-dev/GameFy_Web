'use client'

// Third-party Imports
import Link from 'next/link'

import classnames from 'classnames'

// Component Imports
import LayoutContent from './components/vertical/LayoutContent'

// Util Imports
import { verticalLayoutClasses } from './utils/layoutClasses'

const VerticalLayout = props => {
  // Props
  const { navbar, footer, navigation, children } = props

  return (
    <div className={classnames(verticalLayoutClasses.root, 'flex flex-auto')}>
      <div className={verticalLayoutClasses.navContainer}>
        {navigation || null}
        {/* Link fixo para notas dos alunos */}
        <Link href='/alunos/notas'></Link>
      </div>
      <div className={classnames(verticalLayoutClasses.contentWrapper, 'flex flex-col min-is-0 is-full')}>
        {navbar || null}
        {/* Content */}
        <LayoutContent>{children}</LayoutContent>
        {footer || null}
      </div>
    </div>
  )
}

export default VerticalLayout
