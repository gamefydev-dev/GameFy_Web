// MUI Imports
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

  return (
    // eslint-disable-next-line lines-around-comment
    /* Custom scrollbar instead of browser scroll, remove if you want browser scroll only */
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
      {/* Incase you also want to scroll NavHeader to scroll with Vertical Menu, remove NavHeader from above and paste it below this comment */}
      {/* Vertical Menu */}
      <Menu
        menuItemStyles={menuItemStyles(theme)}
        renderExpandIcon={({ open }) => <RenderExpandIcon open={open} transitionDuration={transitionDuration} />}
        renderExpandedMenuItemIcon={{ icon: <i className='ri-circle-line' /> }}
        menuSectionStyles={menuSectionStyles(theme)}
      >
        {/* DASHBOARD */}
        <SubMenu label='Dashboard' icon={<i className='ri-home-smile-line' />}>
          <MenuItem href='/'>Geral</MenuItem>
          <MenuItem href='/academico'>Acadêmico</MenuItem>
          <MenuItem href='/metricas'>Métricas</MenuItem>
        </SubMenu>

        {/* APPS & PÁGINAS (internas do GameFy) */}
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

        {/* FORMULÁRIOS & TABELAS */}
        <MenuSection label='Formulários'>
          <MenuItem href='/forms/new' icon={<i className='ri-add-box-line' />}>
            Criação de Formulário
          </MenuItem>
          <MenuItem href='/forms' icon={<i className='ri-list-check-2' />}>
            Meus Formulários
          </MenuItem>
        </MenuSection>
      </Menu>
    </ScrollWrapper>
  )
}

export default VerticalMenu
