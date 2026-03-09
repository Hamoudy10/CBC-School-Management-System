// components/ui/Dropdown.tsx
import React from 'react';

export function Dropdown(props: any) {
  return <div {...props}>{props.children || "Dropdown placeholder"}</div>;
}

export function DropdownMenu(props: any) { return <div {...props}/>; }
export function DropdownTrigger(props: any) { return <div {...props}/>; }
export function DropdownContent(props: any) { return <div {...props}/>; }
export function DropdownItem(props: any) { return <div {...props}/>; }
