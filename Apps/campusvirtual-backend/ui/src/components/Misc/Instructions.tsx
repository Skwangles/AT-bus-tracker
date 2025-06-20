import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  MousePointer,
  Search,
  Map,
  User,
  LogOut,
  Circle,
  Square,
  RotateCcw,
  Info,
  X,
} from 'react-feather';
import { useTranslation } from 'react-i18next';

interface InstructionsProps {
  isOpen: boolean;
  onClose: () => void;
}

const Instructions: React.FC<InstructionsProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation('common');
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  const instructionSections = [
    {
      title: t('instructions.title'),
      items: fullScreen
        ? [
            { icon: <MousePointer />, text: t('instructions.navigation.mobile.look') },
          ]
        : [
            {
              icon: (
                <span className="flex items-center gap-2">
                  <span className="key">W</span>
                  <span className="key">A</span>
                  <span className="key">S</span>
                  <span className="key">D</span>
                </span>
              ),
              text: t('instructions.navigation.desktop.move'),
            },
            {
              icon: (
                <span className="flex items-center gap-1">
                  <ArrowUp size={16} />
                  <ArrowLeft size={16} />
                  <ArrowDown size={16} />
                  <ArrowRight size={16} />
                </span>
              ),
              text: t('instructions.navigation.desktop.look'),
            },
            { icon: <MousePointer />, text: t('instructions.navigation.desktop.drag') },
          ],
    },
    {
      title: t('instructions.search.title'),
      items: [
        { icon: <Search />, text: t('instructions.search.useSearch') },
        {
          icon: (
            <>
              <Square color="#ffd700" /> <RotateCcw color="#ffd700" />
            </>
          ),
          text: t('instructions.search.destination'),
        },
        { icon: <Circle color="#4444ff" />, text: t('instructions.search.path') },
      ],
    },
    {
      title: t('instructions.map.title'),
      items: [
        { icon: <Map />, text: t('instructions.map.open') },
        { icon: <User />, text: t('instructions.map.legend.position'), legend: true },
        { icon: <LogOut />, text: t('instructions.map.legend.nextRegion'), legend: true },
        { icon: <Circle color="#ff4444" />, text: t('instructions.map.legend.viewingPoint'), legend: true },
        { icon: <Circle color="#4444ff" />, text: t('instructions.map.legend.highlightedPath'), legend: true },
      ],
    },
    {
      title: t('instructions.help.title'),
      items: [{ icon: <Info />, text: t('instructions.help.toggle') }],
    },
  ];

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      fullScreen={fullScreen}
      maxWidth="md"
      aria-labelledby="instructions-dialog-title"
    >
      <DialogTitle id="instructions-dialog-title">
        {t('instructions.title')}
        <Button
          onClick={onClose}
          style={{ position: 'absolute', right: 8, top: 8 }}
          color="inherit"
        >
          <X />
        </Button>
      </DialogTitle>
      <DialogContent dividers>
        {instructionSections.map((section, index) => (
          <div key={index} style={{ marginBottom: '2em' }}>
            <Typography variant="h6" gutterBottom>
              {section.title}
            </Typography>
            <List dense>
              {section.items.map((item, itemIndex) => (
                <ListItem key={itemIndex} style={item.legend ? { paddingLeft: '32px' } : {}}>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItem>
              ))}
            </List>
          </div>
        ))}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="contained">
          {t('ui.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default Instructions;
