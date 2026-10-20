import type { CardProps } from 'openvue';
import type { HTMLAttributes } from 'vue';

export interface CuiListProps {
  size?: 'default' | 'large';
  dividers?: boolean;
  cardProps?: CardProps;
  cardClass?: HTMLAttributes['class'];
  cardStyle?: HTMLAttributes['style'];
}
