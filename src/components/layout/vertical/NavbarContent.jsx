'use client'

// Next Imports
import { useState, useEffect } from 'react'

// MUI Imports
import IconButton from '@mui/material/IconButton'
import Badge from '@mui/material/Badge'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import Divider from '@mui/material/Divider'
import Button from '@mui/material/Button'

// Third-party Imports
import classnames from 'classnames'

// Custom Imports
import NavToggle from './NavToggle'
import ModeDropdown from '@components/layout/shared/ModeDropdown'
import UserDropdown from '@components/layout/shared/UserDropdown'

// Util Imports
import { verticalLayoutClasses } from '@layouts/utils/layoutClasses'

const NavbarContent = () => {
  const [anchorEl, setAnchorEl] = useState(null)
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread] = useState(0)

  const handleOpen = event => {
    setAnchorEl(event.currentTarget)
    setUnread(0) // marca todas como lidas ao abrir
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  return (
    <div className={classnames(verticalLayoutClasses.navbarContent, 'flex items-center justify-between gap-4 is-full')}>
      <div className='flex items-center gap-2 sm:gap-4'>
        <NavToggle />
      </div>
      <div className='flex items-center'>
        <ModeDropdown />

        {/* 🔔 Botão de Notificações */}
        <IconButton className='text-textPrimary' onClick={handleOpen} aria-label='Abrir notificações'>
          <Badge badgeContent={unread} color='error'>
            <i className='ri-notification-2-line' />
          </Badge>
        </IconButton>

        {/* Menu de Notificações */}
        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleClose}
          PaperProps={{ sx: { width: 300, maxHeight: 400 } }}
        >
          <Typography sx={{ p: 2, fontWeight: 'bold' }}>Notificações</Typography>
          <Divider />
          {notifications.length > 0 ? (
            notifications.map(notif => (
              <MenuItem key={notif.id} onClick={handleClose}>
                <Typography variant='body2' color='text.primary'>
                  {notif.message}
                </Typography>
              </MenuItem>
            ))
          ) : (
            <MenuItem disabled>
              <Typography variant='body2' color='text.secondary'>
                Nenhuma notificação
              </Typography>
            </MenuItem>
          )}
          <Divider />
          <div className='flex justify-center p-2'>
            <Button size='small' onClick={handleClose}>
              Ver todas
            </Button>
          </div>
        </Menu>

        <UserDropdown />
      </div>
    </div>
  )
}

export default NavbarContent
