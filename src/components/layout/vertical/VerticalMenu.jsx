'use client'

// MUI Imports
import { useEffect, useState } from 'react'

import Chip from '@mui/material/Chip'
import { useTheme } from '@mui/material/styles'

// Third-party Imports
import PerfectScrollbar from 'react-perfect-scrollbar'

// Component Imports
import { Menu, SubMenu, MenuItem, MenuSection } from '@menu/vertical-menu'

// Hook Imports
import useVerticalNav from '@menu/hooks/useVerticalNav'

// Styled Component Imports
import StyledVerticalNavExpandIcon from '@menu/styles/vertical/StyledVerticalNavExpandIcon'

// Style Imports
import menuItemStyles from '@core/styles/vertical/menuItemStyles'
import menuSectionStyles from '@core/styles/vertical/menuSectionStyles'

// Auth helper
import { fetchCurrentProfile } from '@/libs/supabaseAuth'

const RenderExpandIcon = ({ open, transitionDuration }) => (
  <StyledVerticalNavExpandIcon open={open} transitionDuration={transitionDuration}>
    <i className='ri-arrow-right-s-line' />
  </StyledVerticalNavExpandIcon>
)

const VerticalMenu = ({ scrollMenu }) => {
  // Hooks
  const theme = useTheme()
  const { isBreakpointReached, transitionDuration } = useVerticalNav()
  const ScrollWrapper = isBreakpointReached ? 'div' : PerfectScrollbar

  // Papel do usuário (student / professor / admin / null)
  const [role, setRole] = useState(null)
  const isStudent = role === 'student'

  useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        const { role: r } = await fetchCurrentProfile()

        if (!alive) return
        setRole(r || null)
      } catch {
        if (!alive) return
        setRole(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [])

  return (
    <ScrollWrapper
      {...(isBreakpointReached
        ? {
            className: 'bs-full overflow-y-auto overflow-x-hidden',
            onScroll: container => scrollMenu(container, false)
          }
        : {
            options: { wheelPropagation: false, suppressScrollX: true },
            onScrollY: container => scrollMenu(container, true)
          })}
    >
      <Menu
        menuItemStyles={menuItemStyles(theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(theme)}
      >
        {/* DASHBOARD — visível apenas para professor/admin */}
        {!isStudent && (
          <SubMenu label='Dashboard' icon={<i className='ri-home-smile-line' />}>
            <MenuItem href='/'>Geral</MenuItem>
            <MenuItem href='/academico'>Acadêmico</MenuItem>
            <MenuItem href='/metricas'>Métricas</MenuItem>
          </SubMenu>
        )}

        {/* APPS & PÁGINAS — apenas professor/admin */}
        {!isStudent && (
          <MenuSection label='Apps & Páginas'>
            <MenuItem href='/eventos' icon={<i className='ri-calendar-event-line' />}>
              Eventos & Ingressos
            </MenuItem>
            <MenuItem href='/grupos' icon={<i className='ri-team-line' />}>
              Grupos
            </MenuItem>
            <MenuItem href='/avaliacoes' icon={<i className='ri-star-smile-line' />}>
              Avaliações
            </MenuItem>
            <MenuItem href='/calendario' icon={<i className='ri-calendar-line' />}>
              Calendário
            </MenuItem>
            <MenuItem href='/kanban' icon={<i className='ri-drag-drop-line' />}>
              Kanban
            </MenuItem>
            <MenuItem href='/account-settings' icon={<i className='ri-user-settings-line' />}>
              Configurações da Conta
            </MenuItem>
            <SubMenu label='Autenticação' icon={<i className='ri-shield-keyhole-line' />}>
              <MenuItem href='/login' target='_blank'>
                Login
              </MenuItem>
              <MenuItem href='/register' target='_blank'>
                Registrar
              </MenuItem>
              <MenuItem href='/forgot-password' target='_blank'>
                Esqueci a Senha
              </MenuItem>
            </SubMenu>
          </MenuSection>
        )}

        {/* FORMULÁRIOS — apenas professor/admin */}
        {!isStudent && (
          <MenuSection label='Formulários'>
            <MenuItem href='/forms/new' icon={<i className='ri-add-box-line' />}>
              Criação de Formulário
            </MenuItem>
            <MenuItem href='/forms' icon={<i className='ri-list-check-2' />}>
              Meus Formulários
            </MenuItem>
          </MenuSection>
        )}

        {/* CONVITES — apenas professor/admin */}
        {!isStudent && (
          <MenuSection label='Convites'>
            <MenuItem href='/precadastro-professores' icon={<i className='ri-presentation-line' />}>
              Convite de Professores
            </MenuItem>
            <MenuItem href='/atribuir' icon={<i className='ri-graduation-cap-line' />}>
              Atribuir Disciplinas
            </MenuItem>
          </MenuSection>
        )}

        {/* Documentação — apenas professor/admin */}
        {!isStudent && (
          <MenuSection label='Documentação'>
            <MenuItem
              href='/professores/documentos'
              icon={<i className='ri-file-code-line' />}
              endContent={<Chip label='v1.0.0' size='small' />}
            >
              Documentação dos PIs
            </MenuItem>
          </MenuSection>
        )}

        {/* Alunos — alunos veem apenas "Notas dos PIs"; pré-cadastro é do professor */}
        <MenuSection label='Alunos'>
          <MenuItem href='/alunos/notas' icon={<i className='ri-file-list-3-line' />}>
            Notas dos PIs
          </MenuItem>
          {!isStudent && (
            <MenuItem href='/precadastro' icon={<i className='ri-user-add-line' />}>
              Pré-cadastro de Alunos
            </MenuItem>
          )}
        </MenuSection>
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
