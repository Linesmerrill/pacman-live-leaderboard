import streamDeck from '@elgato/streamdeck';
import { gameClient } from './client.ts';
import { gameKeyAction, refreshKeys } from './game-key.ts';

streamDeck.actions.registerAction(gameKeyAction);

// Repaint the keys whenever the game state changes, and once a second so the
// POWER MODE countdown on the key stays honest.
gameClient.onChange(() => void refreshKeys());
setInterval(() => {
  if (gameClient.status?.state === 'power-mode') void refreshKeys();
}, 1000);

// No top-level await: the bundle is CommonJS so it runs from the installed plugin folder.
void streamDeck.connect().then(() => {
  streamDeck.logger.info('Pac-Man Maze controller connected to Stream Deck.');
  gameClient.configure();
});
